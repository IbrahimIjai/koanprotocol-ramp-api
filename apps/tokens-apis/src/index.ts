import { Hono } from "hono";
import { cors } from "hono/cors";
import routes from "./routes";

export { TokenValidationSchedulers } from "./durable-objects/token-validators";

const app = new Hono<{ Bindings: Env }>();

app.use(
	"*",
	cors({
		origin: [
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://koanprotocol.xyz",
			"https://www.koanprotocol.xyz",
			"https://koanprotocol.com",
			"https://www.koanprotocol.com",
		],
		credentials: true,
	}),
);

app.get("/", (c) => {
	return c.json({
		message: "Koan Protocol Token API v2",
		version: "2.0.0",
		endpoints: {
			tokens: {
				all: "GET /tokens?chainId=8453 (Includes real-time prices)",
				search:
					"GET /tokens/search?chainId=8453&q=usdc (Search by name, symbol, or address)",
			},
			price: {
				get: "GET /price?chainId=8453&address=0x... (Supports comma-separated batching)",
			},
			balance: {
				get: "GET /balance?account=0x...&chainId=8453 (Multicall balance fetch)",
			},
			validation: {
				info: "GET /validate (Internal list maintenance)",
			},
		},
		features: [
			"Multi-provider token aggregation (LiFi, 1inch, Default)",
			"Batch validation with Durable Objects & Alarms",
			"Two-tier caching (validated & unvalidated)",
			"On-chain verification via viem",
			"Token balance fetching with multicall",
		],
	});
});

app.route("/", routes);

export default app;

// 1. USDC on Base (Chain ID 8453)
// bash
// curl "http://127.0.0.1:7000/price?chainId=8453&address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

// 2. AAVE on Ethereum Mainnet (Chain ID 1)
// bash
// curl "http://127.0.0.1:7000/price?chainId=1&address=0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"

// 3. JUP on Solana (Chain ID "solana")
// bash
// curl "http://127.0.0.1:7000/price?chainId=solana&address=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
// Note: Ensure your local worker
