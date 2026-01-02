import type { TokenProvider } from "./base-provider";
import type { Token } from "../../types/token";
import { addTokenId } from "../../types/token";
import {
	ONE_INCH_TOKEN_BASE_URL,
	ONE_INCH_SUPPORTED_CHAINS,
} from "../../lib/constants";

type OneInchToken = {
	address: string;
	name: string;
	symbol: string;
	decimals: number;
	logoURI?: string;
};

const fetchForChain = async (
	chainId: number,
	apiKey: string,
): Promise<Token[]> => {
	try {
		const response = await fetch(
			`${ONE_INCH_TOKEN_BASE_URL}/v1.2/${chainId}/token-list?provider=1inch`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					accept: "application/json",
				},
			},
		);

		if (!response.ok) {
			console.error(`1inch: chain ${chainId} returned ${response.status}`);
			return [];
		}

		const data = (await response.json()) as
			| Array<unknown>
			| { tokens?: Array<unknown> };

		const tokenList = Array.isArray(data)
			? data
			: (data as { tokens?: Array<unknown> })?.tokens || [];

		if (!Array.isArray(tokenList)) {
			console.error(`1inch: unexpected response format for chain ${chainId}`);
			return [];
		}

		return (tokenList as OneInchToken[]).map((t) =>
			addTokenId({
				chainId,
				address: t.address,
				name: t.name,
				symbol: t.symbol,
				decimals: t.decimals,
				logoUrl: t.logoURI,
			}),
		);
	} catch (error) {
		console.error(`1inch fetch error for chain ${chainId}:`, error);
		return [];
	}
};

export const oneInchProvider: TokenProvider = {
	name: "1inch",

	async fetch(env: Env): Promise<Token[]> {
		const apiKey = env.ONEINCH_API_KEY || "";
		if (!apiKey) {
			console.warn(`${this.name}: no API key provided`);
			return [];
		}

		const results = await Promise.all(
			ONE_INCH_SUPPORTED_CHAINS.map((chainId) =>
				fetchForChain(chainId, apiKey),
			),
		);

		const tokens = results.flat();
		console.log(`${this.name}: fetched ${tokens.length} tokens`);
		return tokens;
	},
};
