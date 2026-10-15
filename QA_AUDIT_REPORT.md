# Ziarat — QA / hardening report (v3)

## Verified in the preparation environment
- Backend unit tests: 32/32 pass (`tsx --test`), including Keccak/EIP-55 vectors, settlement decision rules, fee math.
- Type check of all backend sources: clean (third-party packages stubbed because the sandbox is offline — a real
  `npm ci && npm run typecheck` is still required and may surface SDK signature differences, esp. `privy.ts`).

## NOT verified (no network / no SDKs / no database here)
- `npm ci`, real typecheck, build; Flutter analyze/test/build; PostgreSQL migrations and `npm run test:integration`;
  any live Privy/RPC call. CI (`.github/workflows/ci.yml`) runs all of these — nothing should ship until it is green.

## Changes in v3
Withdrawal lifecycle: crash recovery, on-chain settlement, depth-gated refunds, manual-review tooling with audit log.
Deposits: credited only after confirmations; recipient is now mandatory. Webhook race eliminated (webhook is a hint).
DB: unique ledger movements, append-only ledger and final transaction states enforced by triggers.
Security: EIP-55 checksum validation, address blocklist, production start-up guards (auth key, RPC, KYC, TLS),
authenticated + rate-limited fee quotes, real-IP rate limiting, webhook exempt from rate limit, no-store headers.
Ops: reconciliation endpoint, runbook, strict lockfile Docker build, compose applies all migrations, CI + APK workflow.
App: release builds fail closed without config; hardcoded name and unsupported BTC row removed.

## Revenue (v3.1)
Crypto-withdrawal fee collection with treasury ledger, refund reversal, fee shown in the app before confirm, Max button net of fee,
admin pricing and revenue report (db/004_revenue.sql). Seeded rates are my placeholders, not approved pricing.
Fiat, FX, cards, swaps, bill pay, merchant and subscription revenue remain unbuilt (no providers); their fee rules stay disabled.

## Still required before real customer funds (cannot be done in code)
1. Independent security audit / penetration test and a Privy wallet policy review.
2. KYC/AML provider integration and sanctions screening (only a manual KYC setter and a blocklist exist).
3. Legal/regulatory approval for your jurisdiction and licences for custody/transfer of value.
4. Confirm Privy webhook semantics (`wallet.funds_deposited` / `funds_withdrawn` payloads) on a testnet.
5. Compare ledger liabilities with real on-chain balances daily; monitoring/alerting; backups and restore drill.
6. Fiat rails, cards, swaps, bill pay remain UI placeholders — do not market them.
7. Flutter side was only skimmed (single 33 KB file, no widget/integration tests); on-device testing and app-store review pending.
Nobody can honestly promise "no loopholes"; this list is what stands between this code and that claim.
