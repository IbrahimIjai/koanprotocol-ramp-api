import type { TokenPrice, TokenPriceProvider } from "./types";
import { CHAIN_ID_TO_DEXSCREENER_SLUG } from "./chain-maps";

export class DexScreenerProvider implements TokenPriceProvider {
	name = "dexscreener";

	async getPrice(
		chainId: number | string,
		tokenAddress: string,
		_env?: any,
	): Promise<TokenPrice | null> {
		const chainSlug = CHAIN_ID_TO_DEXSCREENER_SLUG[chainId];
		if (!chainSlug) {
			console.warn(`[DexScreener] Unsupported chain ID: ${chainId}`);
			return null;
		}

		const url = `https://api.dexscreener.com/tokens/v1/${chainSlug}/${tokenAddress}`;

		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(
					`[DexScreener] API error: ${response.status} ${response.statusText}`,
				);
				return null;
			}

			const data = (await response.json()) as any[];
			if (!data || !Array.isArray(data) || data.length === 0) {
				return null;
			}

			// DexScreener returns pairs sorted by some metric (usually relevance/liquidity).
			// We take the first pair.
			const pair = data[0];

			if (!pair.priceUsd) {
				return null;
			}

			return {
				tokenAddress,
				chainId,
				usdPrice: parseFloat(pair.priceUsd), // priceUsd is string in response
			};
		} catch (error) {
			console.error("[DexScreener] Fetch error:", error);
			return null;
		}
	}

	async getPrices(
		chainId: number | string,
		tokenAddresses: string[],
		_env?: any,
	): Promise<TokenPrice[]> {
		const chainSlug = CHAIN_ID_TO_DEXSCREENER_SLUG[chainId];
		if (!chainSlug || tokenAddresses.length === 0) return [];

		const CHUNK_SIZE = 30;
		const results: TokenPrice[] = [];

		for (let i = 0; i < tokenAddresses.length; i += CHUNK_SIZE) {
			const chunk = tokenAddresses.slice(i, i + CHUNK_SIZE);
			const addresses = chunk.join(",");
			const url = `https://api.dexscreener.com/tokens/v1/${chainSlug}/${addresses}`;

			try {
				const response = await fetch(url);
				if (!response.ok) {
					console.error(`[DexScreener] Batch error: ${response.status}`);
					continue;
				}

				const data = (await response.json()) as any[];
				if (Array.isArray(data)) {
					const priceMap = new Map<string, number>();

					for (const pair of data) {
						if (pair.baseToken && pair.baseToken.address && pair.priceUsd) {
							const addr = pair.baseToken.address.toLowerCase();
							if (!priceMap.has(addr)) {
								priceMap.set(addr, parseFloat(pair.priceUsd));
							}
						}
					}

					priceMap.forEach((usdPrice, tokenAddress) => {
						results.push({
							tokenAddress,
							chainId,
							usdPrice,
						});
					});
				}

				if (i + CHUNK_SIZE < tokenAddresses.length) {
					await new Promise((r) => setTimeout(r, 100));
				}
			} catch (error) {
				console.error("[DexScreener] Batch fetch error:", error);
			}
		}

		return results;
	}
}

export const dexscreenerProvider = new DexScreenerProvider();
