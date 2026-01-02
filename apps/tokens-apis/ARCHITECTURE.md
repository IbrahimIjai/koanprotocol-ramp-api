# System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER (Hono)                            │
│                                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ GET /tokens │  │ GET /token   │  │ POST         │  │ GET /validate/  │ │
│  │             │  │              │  │ /validate    │  │ status          │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                │                  │                   │          │
│         ▼                ▼                  ▼                   ▼          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      TOKEN SERVICE LAYER                             │  │
│  │                                                                      │  │
│  │  getTokens() → Check Validated → Check Unvalidated → Fetch Fresh   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│         │                                                     │             │
└─────────┼─────────────────────────────────────────────────────┼─────────────┘
          │                                                     │
          ▼                                                     ▼
┌─────────────────────────┐                    ┌──────────────────────────────┐
│   UPSTASH REDIS CACHE   │                    │   TOKEN PROVIDERS            │
│                         │                    │                              │
│ ┌─────────────────────┐ │                    │  ┌────────┐  ┌──────────┐   │
│ │ tokens:validated    │ │                    │  │  LiFi  │  │  1inch   │   │
│ │ TTL: 1 week         │ │                    │  └────────┘  └──────────┘   │
│ │ isValidated: true   │ │                    │  ┌──────────────────────┐   │
│ └─────────────────────┘ │                    │  │  Default (JSON)      │   │
│                         │                    │  └──────────────────────┘   │
│ ┌─────────────────────┐ │                    └──────────────────────────────┘
│ │ tokens:unvalidated  │ │
│ │ TTL: 1 week         │ │
│ │ Has pst field       │ │                    ┌──────────────────────────────┐
│ └─────────────────────┘ │                    │  DURABLE OBJECT              │
│                         │                    │  "TokenValidationSchedulers" │
│ ┌─────────────────────┐ │                    │                              │
│ │ tokens:validated:   │ │◄───────────────────│  ┌────────────────────────┐ │
│ │ staging             │ │    Writes during   │  │  State Storage:        │ │
│ │ (temp during        │ │    validation      │  │  - currentPosition     │ │
│ │  validation)        │ │                    │  │  - totalTokens         │ │
│ └─────────────────────┘ │                    │  │  - isProcessing        │ │
└─────────────────────────┘                    │  └────────────────────────┘ │
                                               │                              │
                                               │  ┌────────────────────────┐ │
                                               │  │  Alarm System:         │ │
                                               │  │  - Fires every 1 min   │ │
                                               │  │  - Processes 20 tokens │ │
                                               │  │  - Auto-retry on fail  │ │
                                               │  └────────────────────────┘ │
                                               │           │                  │
                                               └───────────┼──────────────────┘
                                                           │
                                                           ▼
                                               ┌──────────────────────────────┐
                                               │  BLOCKCHAIN (via Viem)       │
                                               │                              │
                                               │  ┌────────┐  ┌────────┐     │
                                               │  │  Base  │  │  Lisk  │     │
                                               │  │  8453  │  │  1135  │     │
                                               │  └────────┘  └────────┘     │
                                               │                              │
                                               │  Validates:                  │
                                               │  - name                      │
                                               │  - symbol                    │
                                               │  - decimals                  │
                                               └──────────────────────────────┘
```

## Data Flow

### 1. Initial Token Fetch

```
User Request
    │
    ▼
GET /tokens
    │
    ▼
Check tokens:validated (MISS)
    │
    ▼
Check tokens:unvalidated (MISS)
    │
    ▼
Fetch from Providers (LiFi + 1inch + Default)
    │
    ├─► Merge & Deduplicate
    │
    ├─► Add pst: 0, 1, 2, ... N
    │
    ├─► Save to tokens:unvalidated
    │
    └─► Return to User (without pst)
```

### 2. Validation Process

```
POST /validate
    │
    ▼
Get Durable Object Stub (name: "validator")
    │
    ▼
Initialize State
    ├─► currentPosition: 0
    ├─► totalTokens: N
    └─► isProcessing: true
    │
    ▼
Set Alarm (+1 second)
    │
    ▼
Return 202 Accepted

─────────── Time Passes ───────────

⏰ Alarm Fires (every 1 minute)
    │
    ▼
Get tokens:unvalidated from Redis
    │
    ▼
Filter tokens where pst >= currentPosition
                    AND pst < currentPosition + 20
    │
    ▼
For each token in batch:
    ├─► Call validateSingleToken()
    │       │
    │       ├─► Fetch on-chain data (viem)
    │       │
    │       ├─► Compare name/symbol/decimals
    │       │
    │       └─► Return with isValidated: true/false
    │
    ▼
Append validated batch to tokens:validated:staging
    │
    ▼
Update currentPosition += 20
    │
    ▼
More tokens? ──YES──► Set next alarm (+1 min) ──┐
    │                                             │
    NO                                            │
    │                                             │
    ▼                                             │
Move staging → tokens:validated                  │
    │                                             │
    ▼                                             │
Clear state & alarm                              │
    │                                             │
    ▼                                             │
DONE! ◄───────────────────────────────────────────┘
```

### 3. Subsequent Token Fetches (After Validation)

```
User Request
    │
    ▼
GET /tokens
    │
    ▼
Check tokens:validated (HIT! ✅)
    │
    ▼
Return validated tokens
(isValidated: true for all)
```

## Cache Hierarchy

```
Priority 1: tokens:validated
    ├─ TTL: 1 week
    ├─ Contains: Fully validated tokens
    ├─ Field: isValidated = true
    └─ Source: Durable Object validation

Priority 2: tokens:unvalidated
    ├─ TTL: 1 week
    ├─ Contains: Raw provider data + pst
    ├─ Field: isValidated = false/undefined
    └─ Source: Provider aggregation

Priority 3: Fresh Fetch
    ├─ TTL: N/A (immediate)
    ├─ Contains: Latest provider data
    ├─ Action: Cache as unvalidated
    └─ Source: LiFi + 1inch + Default
```

## Component Responsibilities

### Worker (Hono)

- Route handling
- Request/response formatting
- CORS management
- Error handling

### Token Service

- Cache management
- Provider orchestration
- Deduplication
- Position tracking

### Validation Service

- Single token validation
- On-chain data fetching
- Data comparison
- Result formatting

### Durable Object

- Batch coordination
- State persistence
- Alarm scheduling
- Progress tracking

### Providers

- LiFi: Multi-chain tokens
- 1inch: Supported chains only
- Default: Fallback JSON data

### Redis (Upstash)

- Validated cache (1 week)
- Unvalidated cache (1 week)
- Staging cache (temp)
- Sync timestamps

### Blockchain (Viem)

- On-chain token data
- Name verification
- Symbol verification
- Decimals verification

## Scalability

```
Current: 600 tokens
    ├─ Batches: 30
    ├─ Time: ~30 minutes
    └─ Cost: Free tier ✅

Future: 6,000 tokens
    ├─ Batches: 300
    ├─ Time: ~5 hours
    └─ Cost: Still free tier ✅

Optimization: Parallel Durable Objects
    ├─ Split into 10 validators
    ├─ Each handles 600 tokens
    ├─ Time: ~30 minutes (same)
    └─ Total: 6,000 tokens in 30 min
```

## Error Handling

```
Validation Failure
    │
    ├─► Network Error
    │       └─► Alarm retries automatically
    │
    ├─► Token Contract Error
    │       └─► Mark isValidated: false, continue
    │
    ├─► Timeout
    │       └─► Batch size too large, reduce BATCH_SIZE
    │
    └─► State Corruption
            └─► POST /validate/reset, restart
```

## Security

```
Public Endpoints:
    ├─ GET /tokens ✅
    ├─ GET /token ✅
    ├─ GET /validate ✅
    └─ GET /validate/status ✅

Protected Endpoints (consider adding auth):
    ├─ POST /validate ⚠️
    └─ POST /validate/reset ⚠️

Recommendations:
    ├─ Add API key for POST endpoints
    ├─ Rate limiting on validation
    └─ CORS already configured
```
