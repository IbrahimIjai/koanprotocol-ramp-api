import { Hono } from "hono";

const validateRoute = new Hono<{ Bindings: Env }>();

validateRoute.post("/", async (c) => {
	console.log("Starting token validation via Durable Object...");

	try {
		// Get Durable Object stub
		const id = c.env.TokenValidationSchedulers.idFromName("validator");
		const stub = c.env.TokenValidationSchedulers.get(id);

		// Start validation
		const response = await stub.fetch(
			new Request("http://do/start", {
				method: "POST",
			}),
		);

		const result = (await response.json()) as any;

		return c.json({
			success: response.ok,
			message: result.ok
				? "Validation started - processing in batches"
				: result.error,
			...(typeof result === "object" && result !== null ? result : {}),
		});
	} catch (error) {
		console.error("Validation error:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

validateRoute.get("/status", async (c) => {
	try {
		const id = c.env.TokenValidationSchedulers.idFromName("validator");
		const stub = c.env.TokenValidationSchedulers.get(id);

		const response = await stub.fetch(new Request("http://do/status"));
		const result = (await response.json()) as any;

		return c.json(result);
	} catch (error) {
		console.error("Status error:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

validateRoute.post("/reset", async (c) => {
	try {
		const id = c.env.TokenValidationSchedulers.idFromName("validator");
		const stub = c.env.TokenValidationSchedulers.get(id);

		const response = await stub.fetch(
			new Request("http://do/reset", {
				method: "POST",
			}),
		);
		const result = (await response.json()) as any;

		return c.json(result);
	} catch (error) {
		console.error("Reset error:", error);
		return c.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			500,
		);
	}
});

validateRoute.get("/", async (c) => {
	return c.json({
		message: "Token validation endpoint",
		endpoints: {
			start: "POST /validate - Start batch validation",
			status: "GET /validate/status - Check validation progress",
			reset: "POST /validate/reset - Reset validation state",
		},
		description:
			"Validates tokens in batches of 20 every minute using Durable Objects and Alarms",
	});
});

export default validateRoute;
