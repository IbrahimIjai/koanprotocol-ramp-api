"use client";

import { wagmiAdapter, projectId } from "@/config/web3";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { baseSepolia } from "@reown/appkit/networks";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
	throw new Error("Project ID is not defined");
}

// Set up metadata
const metadata = {
	name: "koanprotocol.xyz",
	description: "A DEX",
	url: "https://koanprotocol.xyz", // origin must match your domain & subdomain
	icons: ["https://koanprotocol.xyz/avatar"],
};

// Create the modal
const modal = createAppKit({
	adapters: [wagmiAdapter],
	projectId,
	networks: [baseSepolia],
	defaultNetwork: baseSepolia,
	metadata: metadata,
	features: {
		analytics: true, // Optional - defaults to your Cloud configuration
	},
});

function Web3ContextProvider({
	children,
	cookies,
}: {
	children: ReactNode;
	cookies: string | null;
}) {
	const initialState = cookieToInitialState(
		wagmiAdapter.wagmiConfig as Config,
		cookies,
	);

	return (
		<WagmiProvider
			config={wagmiAdapter.wagmiConfig as Config}
			initialState={initialState}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</WagmiProvider>
	);
}

export { Web3ContextProvider };
