# Connecting Privy and going live (deposits + withdrawals)

## 1. Privy dashboard (dashboard.privy.io)
1. Create an app → note **App ID**, **App Secret**; create a **Client ID** for the Flutter app.
2. Enable **Email** login (the app uses email code login).
3. **Authorization key**: create one and keep the private key in a secrets manager → `PRIVY_AUTHORIZATION_PRIVATE_KEY`.
   Attach **policies** to server wallets (per-transaction caps, allowed chains/contracts) as a second line of defence
   behind the limits in this backend.
4. **Webhooks** (paid tier; deposit events only on supported chains): add `https://YOUR-API/v1/webhooks/privy`,
   enable `wallet.funds_deposited` and `wallet.funds_withdrawn`, **register the assets to track** (ETH, and the
   USDT / USDC / ZIAR contracts on your chain), then copy the **signing key** → `PRIVY_WEBHOOK_SIGNING_KEY`.
5. Optional: enable **gas sponsorship** and set `PRIVY_SPONSOR_GAS=true`. Otherwise token withdrawals need ETH in the
   user's wallet for gas.

## 2. Configure and deploy
- Fill `backend/.env` (see `.env.example`). Keep `ALLOW_DEV_AUTH=false`; the server refuses `true` in production.
- Start on a **testnet** (`ZIARAT_CHAIN_ID=11155111`) with test token contracts. Mainnet only after section 3 passes.
- ZIAR needs a **deployed contract address** on the chosen chain before it can be enabled.
- Host behind HTTPS. Use `DATABASE_SSL=verify` with your provider's CA. Commit `package-lock.json`.
- Mobile build: `--dart-define=ZIARAT_API_URL`, `ZIARAT_PRIVY_APP_ID`, `ZIARAT_PRIVY_CLIENT_ID`.

## 3. Testnet acceptance (all must pass)
| # | Test | Expect |
|---|------|--------|
| 1 | `npm run typecheck && npm test` | clean (typecheck flags any Privy SDK signature differences) |
| 2 | Log in from the app, open Crypto → Deposit ETH | address + QR shown; same address on repeat |
| 3 | Send test ETH to it | ledger credited once; History shows confirmed deposit |
| 4 | Re-deliver the same webhook (Privy dashboard) | `duplicate_*` outcome, balance unchanged |
| 5 | Send a *different* token with the same symbol | `unsupported_asset`, no credit |
| 6 | Set user `kyc_status='approved'`, `ZIARAT_WITHDRAWALS_ENABLED=true`, withdraw small ETH | status `submitted` → `confirmed` |
| 7 | Withdraw above per-tx / daily limit | 422 `LIMIT_PER_TX` / `LIMIT_PER_DAY` |
| 8 | Retry a withdrawal with the same Idempotency-Key | same result, one debit |
| 9 | Withdraw to a Ziarat deposit address | 400 `INTERNAL_ADDRESS` |
| 10 | Withdraw ERC-20 with and without gas | works with sponsorship/ETH; clean rejection otherwise |

## 4. Verify on first run (could not be checked offline)
- Privy SDK specifics in `backend/src/privy.ts`: wallet-create params, `verifyAccessToken`, `authorization_context`,
  `sponsor`. `npm run typecheck` will flag mismatches.
- Webhook signing key format works with `svix` (`whsec_...`), and `wallet.funds_withdrawn` carries `transaction_hash`.
- Deposit finality: confirm how many confirmations Privy waits for before emitting `wallet.funds_deposited`.
- Token decimals on your chain (USDT/USDC are 6 on Ethereum but 18 on BNB Chain). Override with `ZIARAT_*_DECIMALS`.

## 5. Operations runbook
```sql
-- Approve a user for withdrawals (after your KYC check)
UPDATE users SET kyc_status = 'approved' WHERE external_user_id = 'did:privy:...';

-- Withdrawals needing a human: outcome unknown. Funds stay HELD until resolved.
SELECT id, user_id, asset, amount_minor, address, created_at FROM crypto_transactions
 WHERE status IN ('needs_review','pending') AND created_at < now() - interval '10 minutes';
```
Resolve each `needs_review` by checking the wallet's on-chain history. If it was **sent**: set `status='submitted'`,
fill `tx_hash`. If it was **not sent**: set `status='failed'` and insert the refund through the ledger (credit
with reason `withdrawal_refund`). Never refund without checking the chain.

## 6. Before real customers
KYC/AML and sanctions screening, licensing for your markets, transaction monitoring, incident response, key
management review, and a third-party security review of this code. Bitcoin and fiat are out of scope of this release.
