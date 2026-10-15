# Ziarat — Fintech Polish & Developer Acceptance Plan

This plan uses common premium-fintech interaction patterns as inspiration. It does not copy Fasset's proprietary UI, branding, or assets. Ziarat retains its own deep-emerald identity.

## Implemented in this pass
- Home dashboard balance-visibility control; masks the total balance and fiat/crypto summary amounts together.
- Existing five-tab navigation retained: Home, Assets, Pay, Cards, Profile.
- Existing dark surfaces, emerald/mint accent, rounded cards, and preview-only money-flow messaging retained.

## Priority 1 — app quality
- [ ] Run `flutter pub get`, `dart format lib test`, `flutter analyze`, and `flutter test` using the project's supported Flutter SDK.
- [ ] Check small Android devices, large text/accessibility settings, keyboard overlap, loading, offline, and API-error states.
- [ ] Add widget/golden tests for login, home, assets, payments, cards, profile, and balance masking.
- [ ] Confirm logout and expired-session handling, including when Privy is not configured.
- [ ] Replace placeholder identity initials with the authenticated user's display name/initials, safely handling missing names.

## Priority 2 — finance flows
- [ ] Add dedicated Add Money, Send, Receive, Exchange, and transaction-review screens rather than relying on generic preview sheets.
- [ ] Fetch balances and transaction history from authenticated backend APIs; never treat sample values as live data.
- [ ] Show quote expiry, provider fee, exchange rate, destination details, final amount, and an explicit confirmation step before a real transaction.
- [ ] Add idempotency keys, transaction state transitions, webhook verification, reconciliation, and auditable failure/reversal paths on the backend.
- [ ] Keep deposits/withdrawals disabled until asset/network validation, risk controls, provider sandbox tests, and operational monitoring are complete.

## Priority 3 — production readiness
- [ ] Store provider secrets only on the backend; use environment variables/secrets management and rotate any exposed credentials.
- [ ] Add rate limiting, request validation, authorization checks, structured redacted logs, and security tests.
- [ ] Verify database migrations, indexes, transaction isolation, ledger invariants, and backup/restore.
- [ ] Complete provider eligibility checks for Pakistan/GCC, KYC/AML, sanctions screening, legal review, and settlement operations before enabling regulated services.

## Acceptance rule
A screen or API being present in source is not proof that its complete user journey works. Mark each feature as `Implemented`, `Sandbox-tested`, or `Production-enabled` only when evidence supports that status. All real-money functions remain disabled until their end-to-end checks pass.

## Validation performed for this UI pass
- Source change reviewed: balance toggle state and shared masking for dashboard summary values.
- Flutter/Dart SDK was not available in the preparation environment, so `flutter analyze`, `flutter test`, emulator rendering, and device verification have **not** been run here. The receiving developer must run them before merge.
