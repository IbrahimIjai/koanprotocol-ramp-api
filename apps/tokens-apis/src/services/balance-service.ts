import { getTokensByChainIds } from "./token-service";
import {
	getTokenBalances,
	type TokenBalance,
} from "../viem/helpers/get-balances";
import type { Token } from "../types/token";
import { getNativeToken } from "../lib/constants";

export const getUserBalances = async (
	env: Env,
	account: string,
	chainId: number,
): Promise<TokenBalance[]> => {
	// Fetch all tokens for the specified chain
	const tokens = await getTokensByChainIds(env, chainId);

	// Always include native token for the chain
	const nativeToken = getNativeToken(chainId);
	const allTokens: Token[] = nativeToken ? [nativeToken, ...tokens] : tokens;

	if (allTokens.length === 0) {
		console.log(`No tokens found for chainId ${chainId}`);
		return [];
	}

	console.log(
		`Fetching balances for ${allTokens.length} tokens on chain ${chainId} (including native token)`,
	);

	// Get balances for all tokens (native + ERC20, zero balances already filtered)
	const balances = await getTokenBalances(account, chainId, allTokens);

	return balances;
};
