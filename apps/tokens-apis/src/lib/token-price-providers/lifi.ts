import type { TokenPrice, TokenPriceProvider } from "./types";

export class LifiPriceProvider implements TokenPriceProvider {
	name = "lifi";

	async getPrice(
		chainId: number | string,
		tokenAddress: string,
		_env?: any,
	): Promise<TokenPrice | null> {
		const url = `https://li.quest/v1/token?chain=${chainId}&token=${tokenAddress}`;

		try {
			const response = await fetch(url);
			if (!response.ok) return null;

			const data = (await response.json()) as any;
			if (data.priceUSD) {
				return {
					tokenAddress,
					chainId,
					usdPrice: parseFloat(data.priceUSD),
				};
			}
			return null;
		} catch (error) {
			console.error("[Lifi] Fetch error:", error);
			return null;
		}
	}

	async getPrices(
		chainId: number | string,
		tokenAddresses: string[],
		_env?: any,
	): Promise<TokenPrice[]> {
		if (tokenAddresses.length === 0) return [];

		// Lifi doesn't have a public "multi-token price" GET endpoint that is easy to use,
		// but we can use their /tokens endpoint with filter or just individual fetches in small batches
		// Actually, let's use the /tokens endpoint which we already use for the list.

		const results: TokenPrice[] = [];
		const CHUNK_SIZE = 10; // Lifi is generous but let's be careful

		for (let i = 0; i < tokenAddresses.length; i += CHUNK_SIZE) {
			const chunk = tokenAddresses.slice(i, i + CHUNK_SIZE);

			const promises = chunk.map(async (addr) => {
				try {
					const res = await this.getPrice(chainId, addr);
					return res;
				} catch {
					return null;
				}
			});

			const chunkResults = await Promise.all(promises);
			chunkResults.forEach((r) => {
				if (r) results.push(r);
			});

			// Throttle slightly
			if (i + CHUNK_SIZE < tokenAddresses.length) {
				await new Promise((r) => setTimeout(r, 200));
			}
		}

		return results;
	}
}

export const lifiPriceProvider = new LifiPriceProvider();
