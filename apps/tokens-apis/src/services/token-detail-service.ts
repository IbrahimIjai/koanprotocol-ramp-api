import {
	getTokenFromChain,
	type OnChainTokenData,
} from "../viem/helpers/get-token";
import { getTokensByChainIds } from "./token-service";
import { createTokenId } from "../types/token";
import { createRedisClient, CACHE_KEYS } from "../lib/upstash-redis";

export interface TokenData {
	address: string;
	name: string;
	symbol: string;
	logoUrl: string;
	decimals: number;
}

const METADATA_TTL = 30 * 24 * 60 * 60; // 30 days

export const getTokenDetails = async (
	env: Env,
	address: string,
	chainId: number,
): Promise<TokenData | null> => {
	const normalizedAddress = address.toLowerCase();
	const tokenId = createTokenId(normalizedAddress, chainId);
	const redis = createRedisClient(env);

	// 1. Try Verified List first (indexed tokens)
	const verifiedTokens = await getTokensByChainIds(env, chainId);
	const indexedToken = verifiedTokens.find(
		(t) => t.address.toLowerCase() === normalizedAddress,
	);

	if (indexedToken) {
		return {
			address: indexedToken.address,
			name: indexedToken.name,
			symbol: indexedToken.symbol,
			decimals: indexedToken.decimals,
			logoUrl: indexedToken.logoUrl || "",
		};
	}

	// 2. Try Metadata Cache (tokens verified previously via search or detail)
	const metaKey = `${CACHE_KEYS.METADATA_PREFIX}${chainId}_${normalizedAddress}`;
	try {
		const cachedMeta = await redis.get<TokenData>(metaKey);
		if (cachedMeta) return cachedMeta;
	} catch (e) {
		console.error("[MetaCache] Read error:", e);
	}

	// 3. Fallback to On-Chain RPC
	const onChainData = await getTokenFromChain(normalizedAddress, chainId);
	if (!onChainData) {
		return null;
	}

	const tokenData: TokenData = {
		address: onChainData.address,
		name: onChainData.name,
		symbol: onChainData.symbol,
		decimals: onChainData.decimals,
		logoUrl: "", // On-chain doesn't have logo
	};

	// Save to Metadata Cache for next time
	try {
		await redis.set(metaKey, JSON.stringify(tokenData), { ex: METADATA_TTL });
	} catch (e) {
		console.error("[MetaCache] Write error:", e);
	}

	return tokenData;
};
