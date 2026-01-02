import { Hono } from "hono";
import { getTokenPrice, getTokenPrices } from "../lib/token-price-providers";

const priceRoute = new Hono<{ Bindings: Env }>();

priceRoute.get("/", async (c) => {
	const addressString = c.req.query("address");
	const chainIdParam = c.req.query("chainId");

	if (!addressString) {
		return c.json({ success: false, error: "address is required" }, 400);
	}

	if (!chainIdParam) {
		return c.json({ success: false, error: "chainId is required" }, 400);
	}

	const addresses = addressString.split(",").filter((a) => !!a);
	const isBatch = addresses.length > 1;

	// Support explicit string IDs for non-EVM (e.g. solana) or numeric for EVM
	let chainId: number | string = parseInt(chainIdParam, 10);
	if (isNaN(chainId)) {
		chainId = chainIdParam.toLowerCase();
	}

	try {
		if (isBatch) {
			const prices = await getTokenPrices(chainId, addresses, c.env);
			return c.json({
				success: true,
				data: prices,
			});
		} else {
			const price = await getTokenPrice(chainId, addresses[0], c.env);

			if (!price) {
				return c.json(
					{ success: false, error: "Price not found or invalid token/chain" },
					404,
				);
			}

			return c.json({
				success: true,
				data: price,
			});
		}
	} catch (error) {
		console.error("Error fetching price:", error);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export default priceRoute;
