"use client";

import ContextProvider  from "./reown-wagmi";
import { ThemeProvider } from "./theme-provider";

export function RootProvider({
	children,
	cookies,
}: {
	children: React.ReactNode;
	cookies: string | null;
}) {
	return (
		<>
			<ContextProvider cookies={cookies}>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem
					forcedTheme="light"
					disableTransitionOnChange>
					{children}
				</ThemeProvider>
			</ContextProvider>
		</>
	);
}
