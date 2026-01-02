/**
 * API Test Script for Koan Protocol Token API v2
 *
 * Usage:
 * 1. Ensure your server is running at http://127.0.0.1:7000
 * 2. Run with: node test-apis.js
 */

const BASE_URL = "http://127.0.0.1:7000";

const testData = {
	chainId: 8453, // Base
	tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
	searchQuery: "USDC",
	accountAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", // Sample address
	batchAddresses: [
		"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
		"0x4200000000000000000000000000000000000006", // WETH
	].join(","),
};

async function testEndpoint(name, url, options = {}) {
	try {
		console.log(`Testing: ${name}`);
		console.log(`URL: ${url}`);

		const startTime = Date.now();
		const response = await fetch(url, {
			...options,
			headers: {
				Accept: "application/json",
				...options.headers,
			},
		});
		const duration = Date.now() - startTime;

		let data;
		const contentType = response.headers.get("content-type");
		if (contentType && contentType.includes("application/json")) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (response.ok) {
			console.log(`✅ Success (${duration}ms)`);
			if (typeof data === "object") {
				const resultCount = data.data
					? Array.isArray(data.data)
						? data.data.length
						: 1
					: data.count || "N/A";
				console.log(
					`   Response: Success=${data.success}, Items=${resultCount}`,
				);
				if (data.error) console.log(`   Warning: ${data.error}`);
			} else {
				console.log("   Response snippet:", String(data).substring(0, 100));
			}
		} else {
			console.error(`❌ Failed (${duration}ms)`);
			console.error("   Status:", response.status);
			console.error(
				"   Error:",
				(data && data.error) || data || "Unknown error",
			);
		}
	} catch (error) {
		console.error(`❌ Error testing ${name}:`, error.message);
		if (error.cause) {
			console.error("   Cause:", error.cause.message);
		}
	}
	console.log("-----------------------------------\n");
}

async function runTests() {
	console.log("🚀 Starting Koan Protocol API Tests...\n");

	// 0. Root Endpoint
	await testEndpoint("Root API Info", `${BASE_URL}/`);

	// 1. Get Token List (Base)
	await testEndpoint(
		"Get Token List (Base)",
		`${BASE_URL}/tokens?chainId=${testData.chainId}`,
	);

	// 2. Search Tokens
	await testEndpoint(
		"Search Tokens (USDC)",
		`${BASE_URL}/tokens/search?chainId=${testData.chainId}&q=${testData.searchQuery}`,
	);

	// 3. Get Single Token Details
	await testEndpoint(
		"Get Token Details",
		`${BASE_URL}/token?chainId=${testData.chainId}&address=${testData.tokenAddress}`,
	);

	// 4. Get Token Price
	await testEndpoint(
		"Get Single Price",
		`${BASE_URL}/price?chainId=${testData.chainId}&address=${testData.tokenAddress}`,
	);

	// 4b. Get Batch Token Price
	await testEndpoint(
		"Get Batch Prices",
		`${BASE_URL}/price?chainId=${testData.chainId}&address=${testData.batchAddresses}`,
	);

	// 5. Get User Balance
	await testEndpoint(
		"Get User Balances",
		`${BASE_URL}/balance?chainId=${testData.chainId}&account=${testData.accountAddress}`,
	);

	// 6. Admin Endpoints
	console.log("--- Admin Endpoints ---");
	await testEndpoint("Validation Status", `${BASE_URL}/validate/status`);
	await testEndpoint("Trigger Validation", `${BASE_URL}/validate`, {
		method: "POST",
	});
	// Note: We avoid calling reset by default to not disrupt current state
	// await testEndpoint('Reset Validation', `${BASE_URL}/validate/reset`, { method: 'POST' });

	console.log("\n✅ All tests completed!");
}

runTests().catch(console.error);
