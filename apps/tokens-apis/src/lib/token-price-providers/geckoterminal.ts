import type { TokenPrice, TokenPriceProvider } from "./types";
import { CHAIN_ID_TO_GECKOTERMINAL_SLUG } from "./chain-maps";

export class GeckoTerminalProvider implements TokenPriceProvider {
	name = "geckoterminal";

	async getPrice(
		chainId: number | string,
		tokenAddress: string,
		_env?: any,
	): Promise<TokenPrice | null> {
		const chainSlug = CHAIN_ID_TO_GECKOTERMINAL_SLUG[chainId];
		if (!chainSlug) {
			console.warn(`[GeckoTerminal] Unsupported chain ID: ${chainId}`);
			return null;
		}

		const poolsUrl = `https://api.geckoterminal.com/api/v2/networks/${chainSlug}/tokens/${tokenAddress}/pools?page=1&sort=h24_volume_usd_desc`;
		const tokenUrl = `https://api.geckoterminal.com/api/v2/networks/${chainSlug}/tokens/${tokenAddress}`;

		try {
			// Try pools first as it's more real-time
			const poolResponse = await fetch(poolsUrl, {
				headers: { Accept: "application/json" },
			});

			if (poolResponse.ok) {
				const json = (await poolResponse.json()) as any;
				if (json.data && Array.isArray(json.data) && json.data.length > 0) {
					const attributes = json.data[0].attributes;
					if (attributes && attributes.token_price_usd) {
						return {
							tokenAddress,
							chainId,
							usdPrice: parseFloat(attributes.token_price_usd),
						};
					}
				}
			}

			// Fallback to token endpoint
			const tokenResponse = await fetch(tokenUrl, {
				headers: { Accept: "application/json" },
			});

			if (tokenResponse.ok) {
				const json = (await tokenResponse.json()) as any;
				if (
					json.data &&
					json.data.attributes &&
					json.data.attributes.price_usd
				) {
					return {
						tokenAddress,
						chainId,
						usdPrice: parseFloat(json.data.attributes.price_usd),
					};
				}
			}

			return null;
		} catch (error) {
			console.error("[GeckoTerminal] Fetch error:", error);
			return null;
		}
	}

	async getPrices(
		chainId: number | string,
		tokenAddresses: string[],
		_env?: any,
	): Promise<TokenPrice[]> {
		const chainSlug = CHAIN_ID_TO_GECKOTERMINAL_SLUG[chainId];
		if (!chainSlug || tokenAddresses.length === 0) return [];

		// GeckoTerminal multi endpoint supports up to 30 addresses
		const CHUNK_SIZE = 30;
		const results: TokenPrice[] = [];

		for (let i = 0; i < tokenAddresses.length; i += CHUNK_SIZE) {
			const chunk = tokenAddresses.slice(i, i + CHUNK_SIZE);
			const addresses = chunk.join(",");
			const url = `https://api.geckoterminal.com/api/v2/networks/${chainSlug}/tokens/multi/${addresses}`;

			try {
				const response = await fetch(url, {
					headers: { Accept: "application/json" },
				});

				if (!response.ok) {
					console.error(`[GeckoTerminal] Batch error: ${response.status}`);
					continue;
				}

				const json = (await response.json()) as any;
				if (json.data && Array.isArray(json.data)) {
					for (const item of json.data) {
						if (item.attributes && item.attributes.price_usd) {
							// Address might come back in different casing or as a field
							// item.attributes.address is usually returned
							const addr = item.attributes.address || item.id.split("_")[1];
							results.push({
								tokenAddress: addr,
								chainId,
								usdPrice: parseFloat(item.attributes.price_usd),
							});
						}
					}
				}

				// Optional: Small delay between chunks to be safe
				if (i + CHUNK_SIZE < tokenAddresses.length) {
					await new Promise((r) => setTimeout(r, 100));
				}
			} catch (error) {
				console.error("[GeckoTerminal] Batch fetch error:", error);
			}
		}

		return results;
	}
}

export const geckoTerminalProvider = new GeckoTerminalProvider();
