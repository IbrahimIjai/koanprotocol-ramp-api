const BASE_URL = "http://127.0.0.1:7000";

const testData = {
	chainId: 8453, // Base
	tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
	searchQuery: "USDC",
	accountAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Sample address
};

async function runTests() {
	console.log("🚀 Starting API Tests...\n");

	// 1. Get Token List
	await testEndpoint(
		"GET /tokens",
		`${BASE_URL}/tokens?chainId=${testData.chainId}`,
	);

	// 2. Search Tokens
	await testEndpoint(
		"GET /tokens/search",
		`${BASE_URL}/tokens/search?chainId=${testData.chainId}&q=${testData.searchQuery}`,
	);

	// 3. Get Single Token Details
	await testEndpoint(
		"GET /token",
		`${BASE_URL}/token?chainId=${testData.chainId}&address=${testData.tokenAddress}`,
	);

	// 4. Get Token Price
	await testEndpoint(
		"GET /price",
		`${BASE_URL}/price?chainId=${testData.chainId}&address=${testData.tokenAddress}`,
	);

	// 5. Get User Balance
	await testEndpoint(
		"GET /balance",
		`${BASE_URL}/balance?chainId=${testData.chainId}&account=${testData.accountAddress}`,
	);

	// 6. Admin Endpoints
	console.log("--- Admin Endpoints ---");
	await testEndpoint("GET /validate/status", `${BASE_URL}/validate/status`);
	await testEndpoint("POST /validate", `${BASE_URL}/validate`, {
		method: "POST",
	});
	await testEndpoint("POST /validate/reset", `${BASE_URL}/validate/reset`, {
		method: "POST",
	});

	console.log("\n✅ All tests completed!");
}

async function testEndpoint(name, url, options = {}) {
	try {
		console.log(`Testing: ${name}`);
		console.log(`URL: ${url}`);

		const startTime = Date.now();
		const response = await fetch(url, options);
		const duration = Date.now() - startTime;

		const data = await response.json();

		if (response.ok && data.success !== false) {
			console.log(`✅ Success (${duration}ms)`);
			// console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
		} else {
			console.error(`❌ Failed (${duration}ms)`);
			console.error("Status:", response.status);
			console.error("Error:", data.error || "Unknown error");
		}
	} catch (error) {
		console.error(`❌ Error testing ${name}:`, error.message);
	}
	console.log("-----------------------------------\n");
}

runTests().catch(console.error);
