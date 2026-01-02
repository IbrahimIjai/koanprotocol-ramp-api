export interface Token {
	id: string;
	chainId: number;
	address: string;
	name: string;
	symbol: string;
	decimals: number;
	logoUrl?: string;
	isValidated?: boolean;
}

export type RawToken = Omit<Token, "id">;

export const createTokenId = (address: string, chainId: number): string =>
	`${address.toLowerCase()}:${chainId}`;

export const addTokenId = (token: RawToken): Token => ({
	...token,
	id: createTokenId(token.address, token.chainId),
});

export const deduplicateTokens = (tokens: Token[]): Token[] => {
	const tokenMap = new Map<string, Token>();
	for (const token of tokens) {
		if (!tokenMap.has(token.id)) {
			tokenMap.set(token.id, token);
		}
	}
	return Array.from(tokenMap.values());
};
