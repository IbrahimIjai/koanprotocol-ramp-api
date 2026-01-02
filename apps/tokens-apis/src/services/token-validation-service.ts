import type { Token } from "../types/token";
import { getTokenFromChain } from "../viem/helpers/get-token";
import { getTokens } from "./token-service";
import { saveToCache, CACHE_KEYS } from "../lib/cache";

const BATCH_SIZE = 100;
const CONCURRENCY_PER_BATCH = 10;

export interface ValidationResult {
	total: number;
	validated: number;
	failed: number;
	updated: number;
	failedTokens: Array<{ address: string; chainId: number; error: string }>;
	duration: number;
}

export interface ValidatedToken extends Token {
	validated: boolean;
	onChainName?: string;
	onChainSymbol?: string;
}

export const validateSingleToken = async (
	token: Token,
): Promise<ValidatedToken> => {
	try {
		const onChainData = await getTokenFromChain(token.address, token.chainId);

		if (!onChainData) {
			return { ...token, validated: false };
		}

		return {
			...token,
			name: onChainData.name,
			symbol: onChainData.symbol,
			decimals: onChainData.decimals,
			validated: true,
			onChainName: onChainData.name,
			onChainSymbol: onChainData.symbol,
		};
	} catch (error) {
		return { ...token, validated: false };
	}
};

const processBatchWithConcurrency = async <T, R>(
	items: T[],
	concurrency: number,
	processor: (item: T) => Promise<R>,
): Promise<R[]> => {
	const results: R[] = [];

	for (let i = 0; i < items.length; i += concurrency) {
		const chunk = items.slice(i, i + concurrency);
		const chunkResults = await Promise.all(chunk.map(processor));
		results.push(...chunkResults);
	}

	return results;
};

export const validateAllTokens = async (
	env: Env,
): Promise<ValidationResult> => {
	const startTime = Date.now();

	const allTokens = await getTokens(env);
	console.log(`Starting validation for ${allTokens.length} tokens`);

	const failedTokens: ValidationResult["failedTokens"] = [];
	const validatedTokens: Token[] = [];
	let updatedCount = 0;

	for (
		let batchIndex = 0;
		batchIndex < allTokens.length;
		batchIndex += BATCH_SIZE
	) {
		const batch = allTokens.slice(batchIndex, batchIndex + BATCH_SIZE);
		const batchNumber = Math.floor(batchIndex / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(allTokens.length / BATCH_SIZE);

		console.log(
			`Processing batch ${batchNumber}/${totalBatches} (${batch.length} tokens)`,
		);

		const results = await processBatchWithConcurrency(
			batch,
			CONCURRENCY_PER_BATCH,
			validateSingleToken,
		);

		for (const result of results) {
			if (result.validated) {
				const wasUpdated =
					result.onChainName !== result.name ||
					result.onChainSymbol !== result.symbol;

				if (wasUpdated) {
					updatedCount++;
				}

				validatedTokens.push({
					id: result.id,
					chainId: result.chainId,
					address: result.address,
					name: result.name,
					symbol: result.symbol,
					decimals: result.decimals,
					logoUrl: result.logoUrl,
				});
			} else {
				failedTokens.push({
					address: result.address,
					chainId: result.chainId,
					error: "Failed to fetch on-chain data",
				});
				validatedTokens.push({
					id: result.id,
					chainId: result.chainId,
					address: result.address,
					name: result.name,
					symbol: result.symbol,
					decimals: result.decimals,
					logoUrl: result.logoUrl,
				});
			}
		}

		await saveToCache(env, CACHE_KEYS.ALL_TOKENS, validatedTokens);
		console.log(
			`Batch ${batchNumber} complete. Saved ${validatedTokens.length} tokens to cache`,
		);
	}

	if (failedTokens.length > 0) {
		console.log("=== FAILED TOKENS ===");
		for (const failed of failedTokens) {
			console.log(
				`[FAILED] ${failed.address} on chain ${failed.chainId}: ${failed.error}`,
			);
		}
		console.log("=== END FAILED TOKENS ===");
	}

	const duration = Date.now() - startTime;

	return {
		total: allTokens.length,
		validated: validatedTokens.length - failedTokens.length,
		failed: failedTokens.length,
		updated: updatedCount,
		failedTokens,
		duration,
	};
};
