import { type Address, erc20Abi } from "viem";
import { createViemPublicClient } from "../config";

export interface OnChainTokenData {
	address: string;
	name: string;
	symbol: string;
	decimals: number;
}

export const getTokenFromChain = async (
	address: string,
	chainId: number,
): Promise<OnChainTokenData | null> => {
	try {
		const client = createViemPublicClient(chainId);

		const [name, symbol, decimals] = await Promise.all([
			client.readContract({
				address: address as Address,
				abi: erc20Abi,
				functionName: "name",
			}),
			client.readContract({
				address: address as Address,
				abi: erc20Abi,
				functionName: "symbol",
			}),
			client.readContract({
				address: address as Address,
				abi: erc20Abi,
				functionName: "decimals",
			}),
		]);

		return {
			address,
			name,
			symbol,
			decimals,
		};
	} catch (error) {
		console.error(`Failed to fetch token from chain ${chainId}:`, error);
		return null;
	}
};
