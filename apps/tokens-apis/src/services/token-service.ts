import type { Token } from "../types/token";
import { deduplicateTokens } from "../types/token";
import {
	getFromCache,
	saveToCache,
	shouldRefreshCache,
	CACHE_KEYS,
} from "../lib/cache";
import { createRedisClient } from "../lib/upstash-redis";
import { filterExcludedTokens } from "../lib/constants";
import {
	type TokenProvider,
	lifiProvider,
	oneInchProvider,
	defaultProvider,
} from "../lib/token-lists-providers";
import { getTokenFromChain } from "../viem/helpers/get-token";

const providers: TokenProvider[] = [
	lifiProvider,
	oneInchProvider,
	defaultProvider,
];

const fetchFromAllProviders = async (env: Env): Promise<Token[]> => {
	const results = await Promise.all(
		providers.map((provider) => provider.fetch(env)),
	);
	return results.flat();
};

const fetchAndCacheUnvalidated = async (env: Env): Promise<Token[]> => {
	const allTokens = await fetchFromAllProviders(env);
	const deduplicated = deduplicateTokens(allTokens);

	// Filter out excluded tokens (native tokens, etc.)
	const filteredTokens = filterExcludedTokens(deduplicated);

	console.log(
		`Filtered out ${
			deduplicated.length - filteredTokens.length
		} excluded tokens (native tokens, etc.)`,
	);

	// Add position tracking for validation
	const tokensWithPosition = filteredTokens.map((token, index) => ({
		...token,
		pst: index,
	}));

	const redis = createRedisClient(env);

	await Promise.all([
		redis.set(
			CACHE_KEYS.UNVALIDATED_TOKENS,
			JSON.stringify(tokensWithPosition),
			{
				ex: 7 * 24 * 60 * 60, // 1 week
			},
		),
		saveToCache(env, CACHE_KEYS.LAST_SYNC, Date.now()),
	]);

	console.log(
		`Cached ${filteredTokens.length} unvalidated tokens with position tracking`,
	);

	// Return without pst for API response
	return filteredTokens;
};

export const getTokens = async (env: Env): Promise<Token[]> => {
	// 1. Try validated cache first (1 week TTL)
	const validated = await getFromCache<Token[]>(
		env,
		CACHE_KEYS.VALIDATED_TOKENS,
	);

	console.log({ validated });

	if (validated?.length) {
		console.log(`✅ Validated cache hit: ${validated.length} tokens`);
		return validated;
	}

	// 2. Check if we need to refresh unvalidated cache
	const needsRefresh = await shouldRefreshCache(env);

	console.log({ needsRefresh });

	if (!needsRefresh) {
		const unvalidated = await getFromCache<Token[]>(
			env,
			CACHE_KEYS.UNVALIDATED_TOKENS,
		);

		console.log({ unvalidated });

		if (unvalidated?.length) {
			console.log(`📦 Unvalidated cache hit: ${unvalidated.length} tokens`);
			// Remove pst before returning
			return unvalidated.map(({ pst, ...token }: any) => token);
		}
	}

	// 3. Fetch from providers and cache as unvalidated
	console.log("🔄 Cache miss - fetching from providers...");
	return fetchAndCacheUnvalidated(env);
};

export const getTokensByChainIds = async (
	env: Env,
	chainId: number,
): Promise<Token[]> => {
	const redis = createRedisClient(env);
	const chainListKey = `${CACHE_KEYS.CHAIN_LIST_PREFIX}${chainId}`;

	// 1. Try chain-specific list cache (very fast)
	try {
		const cachedChainList = await redis.get<Token[]>(chainListKey);
		if (cachedChainList?.length) return cachedChainList;
	} catch (e) {
		console.error("[ChainListCache] Read error:", e);
	}

	// 2. Fallback to full list and filter
	const tokens = await getTokens(env);
	const filtered = tokens.filter((t) => t.chainId === chainId);

	// 3. Save to chain-specific cache for next time (1 hour TTL)
	if (filtered.length > 0) {
		try {
			await redis.set(chainListKey, JSON.stringify(filtered), { ex: 3600 });
		} catch (e) {
			console.error("[ChainListCache] Write error:", e);
		}
	}

	return filtered;
};

export const searchTokens = async (
	env: Env,
	chainId: number,
	query: string,
): Promise<Token[]> => {
	const normalizedQuery = query.toLowerCase().trim();
	const redis = createRedisClient(env);
	const searchCacheKey = `search_v1_${chainId}_${normalizedQuery}`;

	// 1. Try Search Cache
	try {
		const cachedResults = await redis.get<Token[]>(searchCacheKey);
		if (cachedResults) return cachedResults;
	} catch {}

	// 2. Check if it's a direct address search
	const isAddress = /^0x[a-fA-F0-9]{40}$/.test(normalizedQuery);

	if (isAddress) {
		const chainTokens = await getTokensByChainIds(env, chainId);
		const existing = chainTokens.find(
			(t) => t.address.toLowerCase() === normalizedQuery,
		);
		if (existing) return [existing];

		const metaKey = `${CACHE_KEYS.METADATA_PREFIX}${chainId}_${normalizedQuery}`;
		try {
			const cachedMeta = await redis.get<any>(metaKey);
			if (cachedMeta) {
				const res = [
					{
						id: `${normalizedQuery}:${chainId}`,
						chainId,
						address: normalizedQuery,
						name: cachedMeta.name,
						symbol: cachedMeta.symbol,
						decimals: cachedMeta.decimals,
					},
				];
				return res;
			}
		} catch {}

		const onChainData = await getTokenFromChain(normalizedQuery, chainId);
		if (onChainData) {
			const newToken: Token = {
				id: `${normalizedQuery}:${chainId}`,
				chainId,
				address: normalizedQuery,
				name: onChainData.name,
				symbol: onChainData.symbol,
				decimals: onChainData.decimals,
			};

			try {
				await redis.set(metaKey, JSON.stringify(onChainData), {
					ex: 30 * 24 * 60 * 60,
				});
			} catch {}

			return [newToken];
		}
		return [];
	}

	// 3. Text search in indexed list
	const chainTokens = await getTokensByChainIds(env, chainId);
	const results = chainTokens.filter(
		(t) =>
			t.name.toLowerCase().includes(normalizedQuery) ||
			t.symbol.toLowerCase().includes(normalizedQuery),
	);

	// Cache search results for 10 minutes
	if (results.length > 0) {
		try {
			await redis.set(searchCacheKey, JSON.stringify(results), { ex: 600 });
		} catch {}
	}

	return results;
};
