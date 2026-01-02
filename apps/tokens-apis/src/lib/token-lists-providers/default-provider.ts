import type { TokenProvider } from "./base-provider";
import type { Token } from "../../types/token";
import { addTokenId } from "../../types/token";
import tokenList from "../../data/koanproocol.tokenlist.json";

export const defaultProvider: TokenProvider = {
	name: "default",

	async fetch(): Promise<Token[]> {
		const tokens = tokenList.tokens.map((t) =>
			addTokenId({
				chainId: t.chainId,
				address: t.address,
				name: t.name,
				symbol: t.symbol,
				decimals: t.decimals,
				logoUrl: t.logoURI,
			}),
		);

		console.log(`${this.name}: loaded ${tokens.length} tokens`);
		return tokens;
	},
};
