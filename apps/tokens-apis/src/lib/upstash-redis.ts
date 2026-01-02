import { Redis } from "@upstash/redis/cloudflare";

export const createRedisClient = (env: Env) => {
	return new Redis({
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN,
	});
};

export const CACHE_KEYS = {
	ALL_TOKENS: "tokens:all",
	LAST_SYNC: "tokens:last_sync",
	UNVALIDATED_TOKENS: "tokens:unvalidated",
	VALIDATED_TOKENS: "tokens:validated",
	STAGING_VALIDATED_TOKENS: "tokens:validated:staging",
	CHAIN_LIST_PREFIX: "list_v1_", // list_v1_{chainId}
	METADATA_PREFIX: "meta_v1_", // meta_v1_{chainId}_{address}
	PRICE_PREFIX: "p_v2_", // p_v2_{chainId}_{address}
} as const;

export const CACHE_TTL_SECONDS = 72 * 60 * 60;
