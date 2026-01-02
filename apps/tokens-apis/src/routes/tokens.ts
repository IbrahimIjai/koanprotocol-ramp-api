import { Hono } from "hono";
import {
	getTokens,
	getTokensByChainIds,
	searchTokens,
} from "../services/token-service";
import { getTokenPrices } from "../lib/token-price-providers";

const tokensRoute = new Hono<{ Bindings: Env }>();

tokensRoute.get("/search", async (c) => {
	const chainIdParam = c.req.query("chainId");
	const q = c.req.query("q");

	if (!chainIdParam || !q) {
		return c.json(
			{ success: false, error: "Missing chainId or q parameter" },
			400,
		);
	}

	const chainId = Number(chainIdParam);
	const tokens = await searchTokens(c.env, chainId, q);

	// Populate prices for results
	const addresses = tokens.map((t) => t.address);
	const prices = await getTokenPrices(chainId, addresses, c.env);
	const priceMap = new Map(
		prices.map((p) => [p.tokenAddress.toLowerCase(), p.usdPrice]),
	);

	const tokensWithPrices = tokens.map((t) => ({
		...t,
		price: priceMap.get(t.address.toLowerCase()) ?? 0,
	}));

	return c.json({
		success: true,
		count: tokensWithPrices.length,
		tokens: tokensWithPrices,
	});
});

tokensRoute.get("/", async (c) => {
	const chainIdParam = c.req.query("chainId");

	if (chainIdParam) {
		const chainId = Number(chainIdParam);
		const tokens = await getTokensByChainIds(c.env, chainId);

		// Fetch prices for all tokens in this chain
		const addresses = tokens.map((t) => t.address);

		const tokensWithPrices = tokens.map((t) => ({
			...t,
		}));

		return c.json({
			success: true,
			count: tokensWithPrices.length,
			tokens: tokensWithPrices,
		});
	}

	const tokens = await getTokens(c.env);
	return c.json({
		success: true,
		count: tokens.length,
		tokens,
	});
});

export default tokensRoute;
