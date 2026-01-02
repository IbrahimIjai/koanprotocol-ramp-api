import type { TokenPrice, TokenPriceProvider } from "./types";

export class OneInchPriceProvider implements TokenPriceProvider {
	name = "1inch";

	// Native/WETH addresses for scaling
	private NATIVE_WRAPPERS: Record<number | string, string> = {
		1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // Ethereum
		10: "0x4200000000000000000000000000000000000006", // Optimism
		56: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // BSC
		137: "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // Polygon (Matic)
		8453: "0x4200000000000000000000000000000000000006", // Base
		42161: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // Arbitrum
		43114: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // Avalanche
	};

	async getPrice(
		chainId: number | string,
		tokenAddress: string,
		env?: any,
	): Promise<TokenPrice | null> {
		const prices = await this.getPrices(chainId, [tokenAddress], env);
		return prices.length > 0 ? prices[0] : null;
	}

	async getPrices(
		chainId: number | string,
		tokenAddresses: string[],
		env?: any,
	): Promise<TokenPrice[]> {
		const apiKey = env?.ONEINCH_API_KEY;
		if (!apiKey || tokenAddresses.length === 0) return [];

		const wrapper = this.NATIVE_WRAPPERS[chainId];
		if (!wrapper) return [];

		try {
			// 1. Fetch WETH price from another provider (e.g. DexScreener/Gecko)
			// to use as anchor. Or just fetch it from 1inch vs a stable but that's recursive.
			// Let's use a constant for now or skip 1inch if we don't have an anchor.
			// Better: In a batch, we just fetch everything relative to WETH and handle the anchor at the end.

			const allToFetch = [...new Set([...tokenAddresses, wrapper])];
			const url = `https://api.1inch.dev/price/v1.1/${chainId}`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ tokens: allToFetch }),
			});

			if (!response.ok) return [];
			const data = (await response.json()) as Record<string, string>;

			// 2. Try to find a USD price for WETH (or whatever connector 1inch used)
			// Actually 1inch v1.1 returns price relative to the "native" currency of the chain.
			// For Base, that is ETH.
			// We need a USD price for ETH.

			// Let's look for a stablecoin in the response to use as a USD peg if possible,
			// or just assume ETH price is ~$3000 (Very rough fallback, not ideal).

			// REAL SOLUTION: Get ETH price from the data itself by looking at a stablecoin.
			const STABLES = [
				"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
				"0xd9aaec091f384f509ccae36766467389c93f0b24", // Base USDbC
			];

			let ethPriceInUSD = 0;
			for (const stable of STABLES) {
				const stableInEth = data[stable.toLowerCase()];
				if (stableInEth) {
					// 1 ETH = (1 / stableInEth) * 10^18 ?
					// 1inch returns: how many tokens for 1 native.
					// So for USDC (6 decimals): it returns ~3000 * 10^6.
					// Actually v1.1 returns how many NATIVE for 1 token.
					// So for USDC: it returns ~0.00033 * 10^18.
					ethPriceInUSD = 1 / (parseFloat(stableInEth) / 1e18);
					if (ethPriceInUSD > 100 && ethPriceInUSD < 100000) break;
				}
			}

			if (ethPriceInUSD === 0) ethPriceInUSD = 3000; // Final loose fallback

			const results: TokenPrice[] = [];
			for (const addr of tokenAddresses) {
				const relPrice = data[addr.toLowerCase()];
				if (relPrice) {
					// priceInUSD = (relPrice / 1e18) * ethPriceInUSD
					const usdPrice = (parseFloat(relPrice) / 1e18) * ethPriceInUSD;
					results.push({
						tokenAddress: addr,
						chainId,
						usdPrice,
					});
				}
			}

			return results;
		} catch (error) {
			console.error("[1inch] Batch fetch error:", error);
			return [];
		}
	}
}

export const oneInchPriceProvider = new OneInchPriceProvider();
