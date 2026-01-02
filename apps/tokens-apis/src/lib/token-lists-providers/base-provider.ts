import type { Token } from "../types/token";

export interface TokenProvider {
	name: string;
	fetch(env: Env): Promise<Token[]>;
}
