import { dexscreenerProvider } from "./dexscreener";
import { geckoTerminalProvider } from "./geckoterminal";
import { oneInchPriceProvider } from "./oneinch";
import { lifiPriceProvider } from "./lifi";
import { CHAIN_ID_TO_DEXSCREENER_SLUG } from "./chain-maps";
import type { TokenPrice } from "./types";
import { createRedisClient, CACHE_KEYS } from "../upstash-redis";

const CACHE_TTL = 300; // 5 minutes

// Local in-memory cache for the duration of a single request execution
const localCache = new Map<string, TokenPrice | null>();

export async function getTokenPrice(
	chainId: number | string,
	tokenAddress: string,
	env?: Env,
): Promise<TokenPrice | null> {
	const normalizedAddress = tokenAddress.toLowerCase();
	const cacheKey = `${CACHE_KEYS.PRICE_PREFIX}${chainId}_${normalizedAddress}`;

	// 1. Try local memory cache (fastest)
	if (localCache.has(cacheKey)) return localCache.get(cacheKey)!;

	// 2. Try Redis Cache
	if (env) {
		try {
			const redis = createRedisClient(env);
			const cached = await redis.get<TokenPrice>(cacheKey);
			if (cached) {
				localCache.set(cacheKey, cached);
				return cached;
			}
		} catch (e) {
			console.error("[PriceCache] Read error:", e);
		}
	}

	const isMapped = !!CHAIN_ID_TO_DEXSCREENER_SLUG[chainId];
	if (!isMapped) {
		return { tokenAddress: normalizedAddress, chainId, usdPrice: 0 };
	}

	try {
		const results = await Promise.all([
			dexscreenerProvider.getPrice(chainId, normalizedAddress, env),
			geckoTerminalProvider.getPrice(chainId, normalizedAddress, env),
			lifiPriceProvider.getPrice(chainId, normalizedAddress, env),
			oneInchPriceProvider.getPrice(chainId, normalizedAddress, env),
		]);

		let finalPriceValue = 0;
		const dex = results[0]?.usdPrice || 0;
		const gecko = results[1]?.usdPrice || 0;
		const lifi = results[2]?.usdPrice || 0;
		const oneInch = results[3]?.usdPrice || 0;

		if (lifi > 0) finalPriceValue = lifi;
		else if (oneInch > 0 && oneInch < 1000000000) finalPriceValue = oneInch;
		else if (dex > 0) finalPriceValue = dex;
		else if (gecko > 0) finalPriceValue = gecko;

		// Last resort: Global search
		if (finalPriceValue === 0) {
			try {
				const globalRes = await fetch(
					`https://api.dexscreener.com/latest/dex/tokens/${normalizedAddress}`,
				);
				if (globalRes.ok) {
					const data = (await globalRes.json()) as any;
					if (data.pairs && data.pairs.length > 0) {
						const pairs = data.pairs.sort(
							(a: any, b: any) =>
								(b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
						);
						if (pairs[0].priceUsd) {
							finalPriceValue = parseFloat(pairs[0].priceUsd);
						}
					}
				}
			} catch {}
		}

		const finalPrice: TokenPrice = {
			tokenAddress: normalizedAddress,
			chainId,
			usdPrice: finalPriceValue,
		};

		// Update caches
		localCache.set(cacheKey, finalPrice);
		if (env) {
			try {
				const redis = createRedisClient(env);
				await redis.set(cacheKey, JSON.stringify(finalPrice), {
					ex: CACHE_TTL,
				});
			} catch (e) {
				console.error("[PriceCache] Write error:", e);
			}
		}

		return finalPrice;
	} catch (error) {
		console.error("[getTokenPrice] Error fetching price:", error);
		return { tokenAddress: normalizedAddress, chainId, usdPrice: 0 };
	}
}

export async function getTokenPrices(
	chainId: number | string,
	tokenAddresses: string[],
	env?: Env,
): Promise<TokenPrice[]> {
	if (tokenAddresses.length === 0) return [];

	const normalizedAddresses = tokenAddresses.map((a) => a.toLowerCase());
	const results: TokenPrice[] = [];
	const missingAddresses: string[] = [];

	// 1. Try Local Memory Cache first
	normalizedAddresses.forEach((addr) => {
		const key = `${CACHE_KEYS.PRICE_PREFIX}${chainId}_${addr}`;
		if (localCache.has(key)) {
			results.push(localCache.get(key)!);
		} else {
			missingAddresses.push(addr);
		}
	});

	if (missingAddresses.length === 0) return results;

	// 2. Try Redis Cache for remaining
	if (env) {
		try {
			const redis = createRedisClient(env);
			const cacheKeys = missingAddresses.map(
				(a) => `${CACHE_KEYS.PRICE_PREFIX}${chainId}_${a}`,
			);
			const cachedResults = await redis.mget<TokenPrice[]>(...cacheKeys);

			const stillMissing: string[] = [];
			missingAddresses.forEach((addr, i) => {
				if (cachedResults[i]) {
					results.push(cachedResults[i]);
					localCache.set(
						`${CACHE_KEYS.PRICE_PREFIX}${chainId}_${addr}`,
						cachedResults[i],
					);
				} else {
					stillMissing.push(addr);
				}
			});

			// Update missingAddresses to those still not found
			missingAddresses.length = 0;
			missingAddresses.push(...stillMissing);
		} catch (e) {
			console.error("[PriceBatchCache] Read error:", e);
		}
	}

	if (missingAddresses.length === 0) return results;

	const isMapped = !!CHAIN_ID_TO_DEXSCREENER_SLUG[chainId];
	if (!isMapped) {
		const zeros = missingAddresses.map((addr) => ({
			tokenAddress: addr,
			chainId,
			usdPrice: 0,
		}));
		return [...results, ...zeros];
	}

	try {
		const [dexS, gecko, lifi, oneInch] = await Promise.all([
			dexscreenerProvider.getPrices!(chainId, missingAddresses, env),
			geckoTerminalProvider.getPrices!(chainId, missingAddresses, env),
			lifiPriceProvider.getPrices!(chainId, missingAddresses, env),
			oneInchPriceProvider.getPrices!(chainId, missingAddresses, env),
		]);

		const fetchedMap = new Map<string, TokenPrice>();
		missingAddresses.forEach((addr) =>
			fetchedMap.set(addr, { tokenAddress: addr, chainId, usdPrice: 0 }),
		);

		gecko.forEach((tp) => fetchedMap.set(tp.tokenAddress.toLowerCase(), tp));
		dexS.forEach((tp) => fetchedMap.set(tp.tokenAddress.toLowerCase(), tp));
		lifi.forEach((tp) => {
			if (tp.usdPrice > 0) fetchedMap.set(tp.tokenAddress.toLowerCase(), tp);
		});
		oneInch.forEach((tp) => {
			if (tp.usdPrice > 0 && tp.usdPrice < 1000000000) {
				fetchedMap.set(tp.tokenAddress.toLowerCase(), tp);
			}
		});

		// Global Fallback for missing
		const stillMissingGlobal = Array.from(fetchedMap.values()).filter(
			(tp) => tp.usdPrice === 0,
		);
		if (stillMissingGlobal.length > 0) {
			const BATCH_SIZE = 10;
			const samples = stillMissingGlobal.slice(0, 20);
			for (let i = 0; i < samples.length; i += BATCH_SIZE) {
				const chunk = samples.slice(i, i + BATCH_SIZE);
				await Promise.all(
					chunk.map(async (tp) => {
						try {
							const res = await fetch(
								`https://api.dexscreener.com/latest/dex/tokens/${tp.tokenAddress}`,
							);
							if (res.ok) {
								const data = (await res.json()) as any;
								if (data.pairs && data.pairs.length > 0) {
									const bestPair = data.pairs.sort(
										(a: any, b: any) =>
											(b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
									)[0];
									if (bestPair.priceUsd)
										tp.usdPrice = parseFloat(bestPair.priceUsd);
								}
							}
						} catch {}
					}),
				);
			}
		}

		const fetchedArray = Array.from(fetchedMap.values());

		// Update caches
		if (env) {
			try {
				const redis = createRedisClient(env);
				const pipeline = redis.pipeline();
				fetchedArray.forEach((tp) => {
					const key = `${
						CACHE_KEYS.PRICE_PREFIX
					}${chainId}_${tp.tokenAddress.toLowerCase()}`;
					localCache.set(key, tp);
					pipeline.set(key, JSON.stringify(tp), { ex: CACHE_TTL });
				});
				await pipeline.exec();
			} catch (e) {
				console.error("[PriceBatchCache] Write error:", e);
			}
		}

		return [...results, ...fetchedArray];
	} catch (error) {
		console.error("[getTokenPrices] batch error:", error);
		const errorFallbacks = missingAddresses.map((addr) => ({
			tokenAddress: addr,
			chainId,
			usdPrice: 0,
		}));
		return [...results, ...errorFallbacks];
	}
}

export * from "./types";
export * from "./dexscreener";
export * from "./geckoterminal";
export * from "./oneinch";
export * from "./lifi";
