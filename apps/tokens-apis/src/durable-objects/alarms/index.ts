import type { Token } from "../../types/token";
import { validateSingleToken } from "../../services/token-validation-service";
import { createRedisClient, CACHE_KEYS } from "../../lib/upstash-redis";

const BATCH_SIZE = 20;
const ALARM_INTERVAL_MS = 60 * 1000;

interface UnvalidatedToken extends Token {
	pst: number;
}

export interface ValidationState {
	currentPosition: number;
	totalTokens: number;
	isProcessing: boolean;
	startedAt?: number;
}

export async function handleAlarm(state: any, env: Env): Promise<void> {
	const validationState = (await state.storage.get("validationState")) as
		| ValidationState
		| undefined;

	if (!validationState || !validationState.isProcessing) {
		console.log("⚠️ No active validation");
		return;
	}

	const { currentPosition, totalTokens } = validationState;
	console.log(
		`⏰ Alarm: ${currentPosition}/${totalTokens} (${Math.round(
			(currentPosition / totalTokens) * 100,
		)}%)`,
	);

	try {
		const redis = createRedisClient(env);
		const unvalidatedTokens = await redis.get<UnvalidatedToken[]>(
			CACHE_KEYS.UNVALIDATED_TOKENS,
		);

		if (!unvalidatedTokens || unvalidatedTokens.length === 0) {
			console.log("❌ No tokens, completing");
			await completeValidation(state, env);
			return;
		}

		const endPosition = currentPosition + BATCH_SIZE;
		const batch = unvalidatedTokens.filter(
			(t) => t.pst >= currentPosition && t.pst < endPosition,
		);

		if (batch.length === 0) {
			console.log("✅ All done, completing");
			await completeValidation(state, env);
			return;
		}

		console.log(
			`🔄 Batch ${currentPosition}-${endPosition - 1} (${batch.length} tokens)`,
		);
		const startTime = Date.now();

		const validatedBatch = await Promise.all(
			batch.map(async (token, idx) => {
				const result = await validateSingleToken(token);
				console.log(
					`   [${idx + 1}/${batch.length}] ${result.validated ? "✅" : "❌"} ${
						token.symbol
					}`,
				);

				return {
					id: result.id,
					chainId: result.chainId,
					address: result.address,
					name: result.name,
					symbol: result.symbol,
					decimals: result.decimals,
					logoUrl: result.logoUrl,
					isValidated: result.validated,
				};
			}),
		);

		const validCount = validatedBatch.filter((t) => t.isValidated).length;
		console.log(
			`✅ Done in ${Date.now() - startTime}ms (${validCount}/${
				batch.length
			} valid)`,
		);

		const existingValidated =
			(await redis.get<Token[]>(CACHE_KEYS.STAGING_VALIDATED_TOKENS)) || [];
		const mergedValidated = [...existingValidated, ...validatedBatch];

		await redis.set(
			CACHE_KEYS.STAGING_VALIDATED_TOKENS,
			JSON.stringify(mergedValidated),
			{
				ex: 7 * 24 * 60 * 60,
			},
		);

		const newPosition = currentPosition + BATCH_SIZE;
		await state.storage.put("validationState", {
			...validationState,
			currentPosition: newPosition,
		} as ValidationState);

		if (newPosition >= totalTokens) {
			console.log("🎉 All tokens processed!");
			await completeValidation(state, env);
		} else {
			const remaining = Math.ceil((totalTokens - newPosition) / BATCH_SIZE);
			console.log(
				`⏭️ Next in ${ALARM_INTERVAL_MS / 1000}s (${remaining} batches left)`,
			);
			await state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
		}
	} catch (error) {
		console.error("❌ Error:", error);
		await state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
		console.log("🔄 Retry scheduled");
	}
}

async function completeValidation(state: any, env: Env): Promise<void> {
	console.log("🏁 Completing validation...");

	try {
		const redis = createRedisClient(env);
		const validatedTokens = await redis.get<Token[]>(
			CACHE_KEYS.STAGING_VALIDATED_TOKENS,
		);

		if (validatedTokens && validatedTokens.length > 0) {
			await redis.set(
				CACHE_KEYS.VALIDATED_TOKENS,
				JSON.stringify(validatedTokens),
				{
					ex: 7 * 24 * 60 * 60,
				},
			);

			const validCount = validatedTokens.filter(
				(t: any) => t.isValidated,
			).length;
			console.log(
				`✅ Complete: ${validatedTokens.length} tokens (${validCount} valid, ${
					validatedTokens.length - validCount
				} invalid)`,
			);
		}

		await state.storage.deleteAlarm();
		await state.storage.put("validationState", {
			currentPosition: 0,
			totalTokens: 0,
			isProcessing: false,
		} as ValidationState);
	} catch (error) {
		console.error("❌ Completion error:", error);
	}
}
