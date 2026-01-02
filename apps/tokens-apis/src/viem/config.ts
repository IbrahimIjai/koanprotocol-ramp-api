import { type Chain, createPublicClient, http } from "viem";
import { base, lisk, baseSepolia, liskSepolia } from "viem/chains";
import { publicActions } from "viem";

export const chainConfigs: Record<number, { chain: Chain; rpcUrl: string }> = {
	8453: {
		chain: base,
		rpcUrl:
			"https://lb.drpc.org/ogrpc?network=base&dkey=AkfK7liJ0koVhAfefqvBTqSGvVRv1W0R8KndCqfUNZ5M",
	},
	1135: {
		chain: lisk,
		rpcUrl:
			"https://lb.drpc.org/ogrpc?network=lisk&dkey=AkfK7liJ0koVhAfefqvBTqSGvVRv1W0R8KndCqfUNZ5M",
	},
	84532: {
		chain: baseSepolia,
		rpcUrl:
			"https://lb.drpc.org/ogrpc?network=base-sepolia&dkey=AkfK7liJ0koVhAfefqvBTqSGvVRv1W0R8KndCqfUNZ5M",
	},
	4202: {
		chain: liskSepolia,
		rpcUrl:
			"https://lb.drpc.org/ogrpc?network=lisk-sepolia&dkey=AkfK7liJ0koVhAfefqvBTqSGvVRv1W0R8KndCqfUNZ5M",
	},
};

export const createViemPublicClient = (chainId: number) => {
	const config = chainConfigs[chainId];

	if (!config) {
		throw new Error(`Unsupported chainId: ${chainId}`);
	}

	return createPublicClient({
		chain: config.chain,
		transport: http(config.rpcUrl),
		cacheTime: 10_000,
	}).extend(publicActions);
};
