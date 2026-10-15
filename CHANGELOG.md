# v3.1.0 — revenue
Withdrawal fee collection (db/004_revenue.sql), treasury account, fee quote + max-sendable endpoints, admin pricing/revenue, app shows fee before confirm.

# v3.0.0 — production hardening
See QA_AUDIT_REPORT.md. New: db/003_hardening.sql, reconciler, admin API, on-chain confirmation, EIP-55 validation,
production start-up guards, CI and Android APK workflows, runbook. Removed unused `viem` dependency.

# v2.0.0

Security / correctness fixes
- Auth: `ALLOW_DEV_AUTH=false` was parsed as true (`z.coerce.boolean`); dev auth is now strict and impossible in production. App no longer sends a default `demo-user` header outside debug builds.
- Webhook: signature is now verified on the **raw** body (was re-serialised JSON); uses Svix directly.
- Webhook payload: matches Privy's real schema; amounts are **base units** (previously decimals ⇒ massive over-credit).
- Deposits matched by chain + **contract address**, not token symbol (fake-token credit).
- Withdrawals: ambiguous send failures no longer auto-refund (double-spend risk) → `needs_review`; confirmation via `wallet.funds_withdrawn`.
- Idempotency scoped per user with request fingerprint; replays return the original result; races handled.
- KYC gate, per-tx/daily limits (checked under a row lock), native fee reserve, no withdrawals to own deposit addresses.
- Ledger: `CHECK balance >= 0`, append-only `ledger_entries`.
- API/app contract bug: app required a `symbol` field the API never returned.

Production readiness
- Readable, typed, modular backend; 18 unit tests on all money/validation logic.
- Pinned dependency ranges, multi-stage non-root Docker, DB not exposed, compose healthchecks, secrets via env.
- DB TLS modes (`disable|require|verify`), CORS off by default, request-log redaction, generic 500s, graceful shutdown.
- Flutter: real Deposit (QR/copy), Withdraw (validation, review, safe retry with persistent idempotency key), History with paging.
- Removed unused tables/deps, stale `dist/`, and the unusable `backend/docker-compose.yml`.

## 2026-10-12 — fintech UI polish
- Added a Home dashboard balance-visibility toggle that masks total, fiat, and crypto summary values together.
- Added a fintech polish implementation plan with explicit testing and production-readiness gates.
- Existing backend, API contracts, authentication, and provider-dependent flows were preserved.
- Flutter analysis/device testing remains pending because the SDK was unavailable in the preparation environment.

## Consolidated source handoff — 2026-10-12
- Combined the latest polished Flutter/backend source with the fee-engine API, SQL migration, fee-engine test file and fee-engine documentation into one project ZIP.
- Added `COMPLETE_SOURCE_MANIFEST.md` and clarified verification limits in `README.md`.
- No claim is made that unintegrated payment rails or production flows are complete.
