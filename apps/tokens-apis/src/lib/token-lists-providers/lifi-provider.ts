import { ChainId, getTokens } from "@lifi/sdk";
import type { TokenProvider } from "./base-provider";
import type { Token } from "../../types/token";
import { addTokenId } from "../../types/token";

export const lifiProvider: TokenProvider = {
	name: "lifi",

	async fetch(): Promise<Token[]> {
		try {
			const response = await getTokens({
				chains: [ChainId.BAS, ChainId.LSK],
			});

			const tokens: Token[] = [];
			for (const [chainId, chainTokens] of Object.entries(response.tokens)) {
				for (const t of chainTokens) {
					tokens.push(
						addTokenId({
							chainId: Number(chainId),
							address: t.address,
							name: t.name,
							symbol: t.symbol,
							decimals: t.decimals,
							logoUrl: t.logoURI,
						}),
					);
				}
			}

			console.log(`${this.name}: fetched ${tokens.length} tokens`);
			return tokens;
		} catch (error) {
			console.error(`${this.name} fetch error:`, error);
			return [];
		}
	},
};
