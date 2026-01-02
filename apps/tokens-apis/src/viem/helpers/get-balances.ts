import { type Address, erc20Abi, getAddress } from "viem";
import { createViemPublicClient } from "../config";
import type { Token } from "../../types/token";
import { NATIVE_TOKEN_ADDRESS } from "../../lib/constants";

export interface TokenBalance extends Token {
	balance: string;
	balanceFormatted: string;
}

export const getTokenBalances = async (
	account: string,
	chainId: number,
	tokens: Token[],
): Promise<TokenBalance[]> => {
	try {
		const client = createViemPublicClient(chainId);
		const checksumAccount = getAddress(account);

		// Filter tokens for the specific chainId
		const chainTokens = tokens.filter((t) => t.chainId === chainId);

		if (chainTokens.length === 0) {
			return [];
		}

		// Separate native token from ERC20 tokens
		const nativeToken = chainTokens.find(
			(t) => t.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase(),
		);
		const erc20Tokens = chainTokens.filter(
			(t) => t.address.toLowerCase() !== NATIVE_TOKEN_ADDRESS.toLowerCase(),
		);

		// Fetch native balance
		let nativeBalance: TokenBalance | null = null;
		if (nativeToken) {
			const balance = await client.getBalance({
				address: checksumAccount as Address,
			});

			if (balance > 0n) {
				const balanceFormatted = (
					Number(balance) / Math.pow(10, nativeToken.decimals)
				).toString();

				nativeBalance = {
					...nativeToken,
					address: getAddress(NATIVE_TOKEN_ADDRESS),
					balance: balance.toString(),
					balanceFormatted,
				};
			}
		}

		// Build multicall contracts array for ERC20 tokens
		const contracts = erc20Tokens.map((token) => ({
			address: getAddress(token.address) as Address,
			abi: erc20Abi,
			functionName: "balanceOf" as const,
			args: [checksumAccount as Address],
		}));

		// Batch fetch all ERC20 balances using multicall
		const results = await client.multicall({
			contracts,
		});

		// Map results back to tokens with balances, filter out zero balances
		const erc20Balances: TokenBalance[] = erc20Tokens
			.map((token, index) => {
				const result = results[index];
				const rawBalance =
					result.status === "success" ? result.result : BigInt(0);

				// Format balance (raw balance / 10^decimals)
				const balanceFormatted = (
					Number(rawBalance) / Math.pow(10, token.decimals)
				).toString();

				return {
					...token,
					address: getAddress(token.address),
					balance: rawBalance.toString(),
					balanceFormatted,
				};
			})
			.filter((b) => BigInt(b.balance) > 0n);

		// Combine native + ERC20 balances
		const allBalances: TokenBalance[] = [];
		if (nativeBalance) {
			allBalances.push(nativeBalance);
		}
		allBalances.push(...erc20Balances);

		return allBalances;
	} catch (error) {
		console.error(`Failed to fetch balances for chain ${chainId}:`, error);
		return [];
	}
};
