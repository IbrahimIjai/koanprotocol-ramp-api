export const ONE_INCH_TOKEN_BASE_URL = "https://api.1inch.dev/token";

export const MAINNET_CHAIN_IDS = {
	BASE: 8453,
	LISK: 1135,
} as const;

export const MAINNET_CHAINS = Object.values(MAINNET_CHAIN_IDS);

// 1inch only supports certain chains - Lisk is not supported
export const ONE_INCH_SUPPORTED_CHAINS = [MAINNET_CHAIN_IDS.BASE] as const;

export type MainnetChainId = (typeof MAINNET_CHAINS)[number];

/**
 * Token addresses to exclude from validation per chain.
 * Typically native tokens (zero address) and common placeholders.
 */
export const EXCLUDED_ADDRESSES: Record<number, string[]> = {
	8453: [
		"0x0000000000000000000000000000000000000000",
		"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
	],
	1135: [
		"0x0000000000000000000000000000000000000000",
		"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
	],
	84532: [
		"0x0000000000000000000000000000000000000000",
		"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
	],
	4202: [
		"0x0000000000000000000000000000000000000000",
		"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
	],
};

/** Check if a token address should be excluded */
export const shouldExcludeToken = (
	address: string,
	chainId: number,
): boolean => {
	const excludedForChain = EXCLUDED_ADDRESSES[chainId] || [];
	const normalizedAddress = address.toLowerCase();

	return excludedForChain.some(
		(excluded) => excluded.toLowerCase() === normalizedAddress,
	);
};

/** Filter out excluded tokens from a list */
export const filterExcludedTokens = <
	T extends { address: string; chainId: number },
>(
	tokens: T[],
): T[] => {
	return tokens.filter(
		(token) => !shouldExcludeToken(token.address, token.chainId),
	);
};

import type { Token } from "../types/token";

export const NATIVE_TOKEN_ADDRESS =
	"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Native token configuration per chain
export const NATIVE_TOKENS: Record<number, Omit<Token, "id">> = {
	// Base Mainnet
	8453: {
		chainId: 8453,
		address: NATIVE_TOKEN_ADDRESS,
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
		logoUrl:
			"https://raw.githubusercontent.com/Koan-Protocol/token-list/main/token-list/src/logos/native/eth.png",
	},
	// Lisk Mainnet
	1135: {
		chainId: 1135,
		address: NATIVE_TOKEN_ADDRESS,
		name: "Ether",
		symbol: "ETH",
		decimals: 18,
		logoUrl:
			"https://raw.githubusercontent.com/Koan-Protocol/token-list/main/token-list/src/logos/native/eth.png",
	},
	// Base Sepolia
	84532: {
		chainId: 84532,
		address: NATIVE_TOKEN_ADDRESS,
		name: "Sepolia Ether",
		symbol: "ETH",
		decimals: 18,
		logoUrl:
			"https://raw.githubusercontent.com/Koan-Protocol/token-list/main/token-list/src/logos/native/eth.png",
	},
	// Lisk Sepolia
	4202: {
		chainId: 4202,
		address: NATIVE_TOKEN_ADDRESS,
		name: "Sepolia Ether",
		symbol: "ETH",
		decimals: 18,
		logoUrl:
			"https://raw.githubusercontent.com/Koan-Protocol/token-list/main/token-list/src/logos/native/eth.png",
	},
};

export const getNativeToken = (chainId: number): Token | null => {
	const nativeConfig = NATIVE_TOKENS[chainId];
	if (!nativeConfig) return null;

	return {
		...nativeConfig,
		id: `${NATIVE_TOKEN_ADDRESS.toLowerCase()}:${chainId}`,
	};
};
