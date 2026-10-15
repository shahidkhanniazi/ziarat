# Integration checklist

- [ ] Privy app, client ID, app secret, authorization key, webhook + signing key
- [ ] Assets registered for webhooks; token contracts + decimals confirmed on the chosen chain
- [ ] `backend/.env` complete; `ALLOW_DEV_AUTH=false`; limits set for every enabled asset
- [ ] `npm install` → commit `package-lock.json`; `npm run typecheck`; `npm test`
- [ ] Postgres initialised with `db/001_init.sql`; `DATABASE_SSL=verify` in production
- [ ] Testnet acceptance table in `PRODUCTION_SETUP.md` fully passed
- [ ] Flutter: `flutter pub get && flutter analyze && flutter test`; release build with `--dart-define`s
- [ ] KYC process wired to `users.kyc_status`; ops runbook owner named for `needs_review`
- [ ] Legal/compliance sign-off; security review; mainnet switch is a deliberate, separate step
