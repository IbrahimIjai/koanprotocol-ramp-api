# Koan Protocol Token API v2 Documentation

Welcome to the Koan Protocol Token API. This API provides comprehensive access to verified token lists, real-time USD pricing from multiple providers, cross-chain search capabilities, and user balance tracking.

## Base URL

- **Production**: `https://token-api-v2.koanprotocol.workers.dev` (Example)
- **Local Development**: `http://127.0.0.1:7000`

---

## 1. Token Endpoints

### Get Token List

Retrieves the list of verified tokens for a specific chain.

- **Endpoint**: `GET /tokens`
- **Query Parameters**:
  - `chainId` (required): The numeric ID of the chain (e.g., `8453` for Base, `1135` for Lisk).
- **Response Features**:
  - Automatically includes current **USD price** for every token.
  - Returns metadata including logo, decimals, name, and symbol.

**Example Request**:

```bash
curl "http://127.0.0.1:7000/tokens?chainId=8453"
```

### Search Tokens

Searches for tokens by name, symbol, or contract address.

- **Endpoint**: `GET /tokens/search`
- **Query Parameters**:
  - `chainId` (required): The numeric ID of the chain.
  - `q` (required): Search query (e.g., "usdc" or "0x...").
- **Smart Features**:
  - **Text Search**: Matches against Name and Symbol in our verified index.
  - **Address Search**: If a contract address is provided, the API verifies it on-chain (ERC20 metadata) if not already indexed.
  - **Live Pricing**: Every search result includes the current USD price.

**Example Request**:

```bash
curl "http://127.0.0.1:7000/tokens/search?chainId=8453&q=Higher"
```

### Get Single Token Details

Fetches detailed metadata and on-chain status for a single token.

- **Endpoint**: `GET /token`
- **Query Parameters**:
  - `chainId` (required): The numeric ID of the chain.
  - `address` (required): The token contract address.

**Example Request**:

```bash
curl "http://127.0.0.1:7000/token?chainId=8453&address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
```

---

## 2. Pricing Endpoints

### Get Token Prices (Single or Batch)

Fetches USD prices for one or more tokens using a robust 4-provider fallback stack (1inch, LiFi, DexScreener, GeckoTerminal).

- **Endpoint**: `GET /price`
- **Query Parameters**:
  - `chainId` (required): The numeric ID of the chain.
  - `address` (required): A single address OR a comma-separated list of addresses.
- **Features**:
  - **Batching**: Group up to 50 addresses in a single call.
  - **Caching**: Prices are cached for 5 minutes in Upstash Redis for high-performance retrieval.

**Example Request**:

```bash
curl "http://127.0.0.1:7000/price?chainId=8453&address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,0x4200000000000000000000000000000000000006"
```

---

## 3. Balance Endpoints

### Get User Balances

Retrieves ERC20 balances for a user account across all verified tokens on a specific chain.

- **Endpoint**: `GET /balance`
- **Query Parameters**:
  - `chainId` (required): The numeric ID of the chain.
  - `account` (required): The user's wallet address.
- **Performance**: Uses **multicall** internally to fetch all token balances in a single blockchain call.

**Example Request**:

```bash
curl "http://127.0.0.1:7000/balance?chainId=8453&account=0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
```

---

## 4. Admin & Validation

_Internal endpoints used to maintain the token list integrity._

- **POST /validate**: Triggers the batch validation process (processes tokens in chunks of 20 every minute via Durable Objects).
- **GET /validate/status**: Checks the current progress of the ongoing validation.
- **POST /validate/reset**: Clears the current validation state.

---

## Supported Chains

| Chain Name | Chain ID | Slug     |
| ---------- | -------- | -------- |
| Ethereum   | 1        | eth      |
| Base       | 8453     | base     |
| Lisk       | 1135     | lisk     |
| Optimism   | 10       | optimism |
| Arbitrum   | 42161    | arbitrum |
| Polygon    | 137      | polygon  |
| BSC        | 56       | bsc      |
| Monad      | 143      | monad    |

---

## Response Formats

Standard successful response:

```json
{
  "success": true,
  "data": [...], // Or "token": {...}
  "count": 123
}
```

Error response:

```json
{
	"success": false,
	"error": "Error message description"
}
```
