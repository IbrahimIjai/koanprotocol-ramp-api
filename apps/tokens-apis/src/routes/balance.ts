import { Hono } from "hono";
import { getUserBalances } from "../services/balance-service";

const balanceRoute = new Hono<{ Bindings: Env }>();

balanceRoute.get("/", async (c) => {
	const account = c.req.query("account");
	const chainIdParam = c.req.query("chainId");

	if (!account) {
		return c.json({ success: false, error: "account is required" }, 400);
	}

	if (!chainIdParam) {
		return c.json({ success: false, error: "chainId is required" }, 400);
	}

	const chainId = parseInt(chainIdParam, 10);
	if (isNaN(chainId)) {
		return c.json({ success: false, error: "chainId must be a number" }, 400);
	}

	// Validate account address format (basic check)
	if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
		return c.json({ success: false, error: "Invalid account address" }, 400);
	}

	const balances = await getUserBalances(c.env, account, chainId);

	return c.json({
		success: true,
		account,
		chainId,
		count: balances.length,
		balances,
	});
});

export default balanceRoute;
