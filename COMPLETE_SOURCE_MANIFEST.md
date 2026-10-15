# Consolidated Source Manifest

This archive intentionally brings the available source into one project folder. It does not invent or imply implementation of features whose provider integrations are absent.

## Included components
- Flutter mobile app: Dart screens, models, API client, authentication/crypto service wrappers.
- Backend API: Node.js + TypeScript with Fastify, validation, authentication helpers, asset endpoints, deposit/withdrawal foundations, ledger and fee quote endpoints.
- Database: initial schema plus fee-engine migration.
- Tests: Dart model/amount tests and backend amount/assets/deposit parsing/withdrawal-rule/fee quote tests.
- Docs: UI/UX handoff, architecture, API contract, production setup, integration checklist, fee-engine and polish plans.

## Explicitly not certified as complete
- Production-grade bank accounts, fiat rails, FX liquidity, card issuing, biller integrations, merchant settlement, payment links, live crypto on/off-ramp, or live swap providers.
- Production readiness, compliance/KYC/AML approval, penetration testing, full ledger reconciliation, and provider webhook reliability.
- All tests passing: no complete Flutter or backend build/test run was performed in the packaging environment.

## Required developer acceptance checklist
- [ ] `flutter pub get`
- [ ] `dart format lib test`
- [ ] `flutter analyze`
- [ ] `flutter test`
- [ ] `npm install` in `backend/`
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] Apply `db/001_init.sql` then `db/002_fee_engine.sql` to a clean test database
- [ ] Verify `/health`, `/v1/fees/services`, and `/v1/fees/quote`
- [ ] End-to-end test authentication, deposits, withdrawals, idempotency, ledger/reconciliation and provider failures
- [ ] Configure only finance-approved fee rates; keep all services disabled until tested
