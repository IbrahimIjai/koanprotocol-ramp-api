import { DurableObject } from "cloudflare:workers";
import { handleAlarm, type ValidationState } from "./alarms";
import { createRedisClient, CACHE_KEYS } from "../lib/upstash-redis";

interface UnvalidatedToken {
	pst: number;
	[key: string]: any;
}

const BATCH_SIZE = 20;

export class TokenValidationSchedulers extends DurableObject {
	state: DurableObjectState;
	env: Env;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/start" && request.method === "POST") {
			return this.startValidation();
		}

		if (url.pathname === "/status") {
			return this.getStatus();
		}

		if (url.pathname === "/reset" && request.method === "POST") {
			return this.reset();
		}

		return this.jsonResponse({ ok: false, error: "Not found" }, 404);
	}

	async alarm() {
		await handleAlarm(this.state, this.env);
	}

	private async startValidation(): Promise<Response> {
		try {
			const redis = createRedisClient(this.env);

			// Get all tokens from unvalidated cache
			const unvalidatedTokens = await redis.get<UnvalidatedToken[]>(
				CACHE_KEYS.UNVALIDATED_TOKENS,
			);

			if (!unvalidatedTokens || unvalidatedTokens.length === 0) {
				return this.jsonResponse(
					{
						ok: false,
						error:
							"No unvalidated tokens found. Please populate the cache first.",
					},
					400,
				);
			}

			// Initialize validation state
			const validationState: ValidationState = {
				currentPosition: 0,
				totalTokens: unvalidatedTokens.length,
				isProcessing: true,
				startedAt: Date.now(),
			};

			await this.state.storage.put("validationState", validationState);

			// Clear staging cache
			await redis.del(CACHE_KEYS.STAGING_VALIDATED_TOKENS);

			// Set first alarm immediately
			await this.state.storage.setAlarm(Date.now() + 1000);

			return this.jsonResponse({
				ok: true,
				message: "Validation started",
				totalTokens: unvalidatedTokens.length,
				batchSize: BATCH_SIZE,
				estimatedBatches: Math.ceil(unvalidatedTokens.length / BATCH_SIZE),
			});
		} catch (error) {
			console.error("Start validation error:", error);
			return this.jsonResponse(
				{
					ok: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
				500,
			);
		}
	}

	private async getStatus(): Promise<Response> {
		const validationState = await this.state.storage.get<ValidationState>(
			"validationState",
		);
		const nextAlarm = await this.state.storage.getAlarm();

		return this.jsonResponse({
			ok: true,
			state: validationState || null,
			nextAlarm: nextAlarm ? new Date(nextAlarm).toISOString() : null,
			progress: validationState
				? `${validationState.currentPosition}/${validationState.totalTokens}`
				: "Not started",
		});
	}

	private async reset(): Promise<Response> {
		await this.state.storage.deleteAlarm();
		await this.state.storage.delete("validationState");

		return this.jsonResponse({
			ok: true,
			message: "Validation state reset",
		});
	}

	private jsonResponse(data: unknown, status = 200): Response {
		return new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json" },
		});
	}
}
