# Architecture

```text
Flutter app --HTTPS + Privy access token--> Ziarat API (Fastify)
                                              |-- PostgreSQL: users, wallets, ledger, ledger_entries, crypto_transactions, webhook_events
                                              |-- Privy: create wallets, sign + send transactions
Privy --signed webhooks (svix)--> /v1/webhooks/privy --> ledger credit / withdrawal confirmation
```

**Deposits.** One Privy EVM wallet per user. A deposit is credited only from a *signature-verified* webhook whose
wallet, chain and **contract address** match a configured asset. Amounts arrive in base units and are credited
exactly. Credit + transaction row are one DB transaction keyed by Privy's `idempotency_key`, so redelivery is harmless.

**Withdrawals.** (1) One DB transaction checks KYC, limits and balance, debits the ledger and records a `pending`
row. (2) Only the request that created the row sends via Privy. (3) Result: `submitted` (hash stored) →
`confirmed` by webhook; a definite provider rejection (4xx) refunds; an **ambiguous** failure (timeout/5xx) becomes
`needs_review` and funds stay held, because the transfer may already be on-chain.

**Safety defaults.** Withdrawals off, KYC required, limits mandatory, testnet by default, dev auth impossible in
production, per-user idempotency with request fingerprinting, append-only `ledger_entries`.
