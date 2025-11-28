import { Geist, Geist_Mono } from "next/font/google";

import "@workspace/ui/globals.css";
import { headers } from "next/headers";
import { RootProvider } from "@/providers/root-provider";

const fontSans = Geist({
	subsets: ["latin"],
	variable: "--font-sans",
});

const fontMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const headersObj = await headers();
	const cookies = headersObj.get("cookie");
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}>
				<RootProvider cookies={cookies}>{children}</RootProvider>
			</body>
		</html>
	);
}
