export interface TokenPrice {
	tokenAddress: string;
	chainId: number | string;
	usdPrice: number;
}

export interface TokenPriceProvider {
	name: string;
	getPrice(
		chainId: number | string,
		tokenAddress: string,
		env?: any,
	): Promise<TokenPrice | null>;
	getPrices?(
		chainId: number | string,
		tokenAddresses: string[],
		env?: any,
	): Promise<TokenPrice[]>;
}
