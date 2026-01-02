import { Hono } from "hono";
import { getTokenDetails } from "../services/token-detail-service";

const tokenRoute = new Hono<{ Bindings: Env }>();

tokenRoute.get("/", async (c) => {
	const address = c.req.query("address");
	const chainIdParam = c.req.query("chainId");

	if (!address) {
		return c.json({ success: false, error: "address is required" }, 400);
	}

	if (!chainIdParam) {
		return c.json({ success: false, error: "chainId is required" }, 400);
	}

	const chainId = parseInt(chainIdParam, 10);
	if (isNaN(chainId)) {
		return c.json({ success: false, error: "chainId must be a number" }, 400);
	}

	const token = await getTokenDetails(c.env, address, chainId);

	if (!token) {
		return c.json(
			{ success: false, error: "Token not found or invalid address" },
			404,
		);
	}

	return c.json({
		success: true,
		token,
	});
});

export default tokenRoute;
