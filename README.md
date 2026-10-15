# Ziarat — Consolidated Source Handoff

This is the **single consolidated source ZIP** assembled from the latest available Ziarat Flutter/backend source and the fee-engine package. It is a developer handoff, not a claim that every fintech feature is production-ready.

## Repository structure

- `lib/` — Flutter/Dart mobile application (screens, models, API client, auth/crypto service abstractions).
- `backend/` — Node.js + TypeScript API, auth helpers, assets, wallets, ledger, deposit/withdrawal foundations, and fee quote API.
- `db/001_init.sql` — initial database schema.
- `db/002_fee_engine.sql` — fee service/rules/quotes schema and 11 fee categories.
- `test/` — Flutter/Dart tests.
- `backend/test/` — TypeScript tests, including fee quote input-contract checks.
- `docs/` — architecture, API, production setup, integration checklist, UI handoff, and fee-engine notes.

## Fee engine included

- `GET /v1/fees/services`
- `POST /v1/fees/quote`
- Percentage fee, fixed fee, minimum/maximum fee and estimated provider-cost fields.
- Five-minute informational quote expiry.
- 11 categories: wallet transfer, international transfer, FX conversion, crypto swap, crypto deposit, crypto withdrawal, merchant payment, payment link, business payout, bill payment, card transaction.

**Important:** No commercial rates are approved or seeded. Services are disabled by default. Quotes do not execute transfers or collect fees. The fee migration must be applied after `db/001_init.sql`.

## Start locally (developer environment required)

### Flutter
1. Install a compatible Flutter SDK.
2. From this directory run `flutter pub get`.
3. Run `dart format lib test`, `flutter analyze`, and `flutter test`.

### Backend
1. Install Node.js 20+ and PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and supply valid development-only values.
3. Apply `db/001_init.sql`, `db/002_fee_engine.sql`, `db/003_hardening.sql`, then `db/004_revenue.sql` to the configured database.
4. From `backend/`, run `npm install`, `npm test`, `npm run typecheck`, and `npm run build`.
5. Start with `npm run dev` for local development.

Do not commit `.env` or production credentials.

## Verification status

- ZIP archive integrity: to be checked after packaging.
- Required source files and fee-engine routes: included in this archive.
- Full Flutter build/analyzer/tests: not run in this environment (Flutter SDK unavailable).
- Backend dependency install/build/integration tests: not run here; require dependencies and a PostgreSQL database.
- Live payment provider integrations, production security review, regulatory/compliance approval, reconciliation and end-to-end transaction testing: not certified by this handoff.

See `docs/OPERATIONS_RUNBOOK.md`, `docs/ANDROID_BUILD.md` and `QA_AUDIT_REPORT.md` (v3).

## Do not misrepresent readiness

This source includes app/backend foundations and an informational fee engine. It is not a fully integrated production fintech system. A developer must run the commands above, fix any failures, configure approved pricing, implement provider integrations, and complete security/compliance review before handling real customer funds.
