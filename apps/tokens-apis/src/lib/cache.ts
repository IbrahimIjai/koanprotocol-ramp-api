import {
	createRedisClient,
	CACHE_KEYS,
	CACHE_TTL_SECONDS,
} from "./upstash-redis";

export const getFromCache = async <T>(
	env: Env,
	key: string,
): Promise<T | null> => {
	try {
		const redis = createRedisClient(env);
		const data = await redis.get<string>(key);
		if (!data) return null;
		return typeof data === "string" ? JSON.parse(data) : data;
	} catch {
		return null;
	}
};

export const saveToCache = async <T>(
	env: Env,
	key: string,
	data: T,
): Promise<void> => {
	try {
		const redis = createRedisClient(env);
		await redis.set(key, JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
	} catch (error) {
		console.error(`Cache save error for ${key}:`, error);
	}
};

export const shouldRefreshCache = async (env: Env): Promise<boolean> => {
	const lastSync = await getFromCache<number>(env, CACHE_KEYS.LAST_SYNC);
	if (!lastSync) return true;
	const elapsed = Date.now() - lastSync;
	return elapsed > CACHE_TTL_SECONDS * 1000;
};

export { CACHE_KEYS };
