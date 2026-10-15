# API (v1) — all `/v1/crypto/*` routes need `Authorization: Bearer <Privy access token>`

Errors: `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "..." } }`

| Route | Purpose |
|---|---|
| `GET /health`, `GET /ready` | liveness / DB readiness |
| `GET /v1/crypto/assets` | `{ withdrawalsEnabled, assets:[{code,symbol,name,network,networkId,decimals,native,balance,available,withdrawalsEnabled}] }` |
| `POST /v1/crypto/deposit-address` `{asset}` | `{asset,network,networkId,address,warning}` |
| `GET /v1/crypto/transactions?limit&before` | `{ transactions:[{id,asset,symbol,network,type,amount,status,address,txHash,createdAt}], nextBefore }` |
| `POST /v1/crypto/withdrawals` `{asset,address,amount}` + header `Idempotency-Key` (16–100 chars) | `200 {id,status:'submitted',txHash}` · `202 {status:'needs_review'}` · errors below |
| `POST /v1/webhooks/privy` | Privy only (svix-signed raw body) |

Withdrawal error codes: `WITHDRAWALS_DISABLED 503`, `KYC_REQUIRED 403`, `INVALID_ADDRESS/INVALID_AMOUNT/TOO_MANY_DECIMALS 400`,
`INTERNAL_ADDRESS 400`, `INSUFFICIENT_FUNDS 409`, `LIMIT_PER_TX/LIMIT_PER_DAY 422`, `IDEMPOTENCY_MISMATCH 422`,
`WITHDRAWAL_REJECTED 422`. Statuses: `pending, submitted, confirmed, failed, needs_review`.
Amounts are decimal strings. Retry a request with the **same** key only when the result is unknown.
