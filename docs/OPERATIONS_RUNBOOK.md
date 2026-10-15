# Operations runbook

## What runs automatically
Every `ZIARAT_RECONCILE_INTERVAL_SECONDS` (one instance at a time, advisory lock) the API:
1. moves withdrawals stuck in `pending` (crash mid-send) to `needs_review` — **never auto-refunded**;
2. settles `submitted` withdrawals from the chain: `confirmed` after `ZIARAT_MIN_CONFIRMATIONS`; **refunded only** if the tx
   reverted at that depth; unknown to the chain for `ZIARAT_DROPPED_TX_SECONDS` → `needs_review`;
3. credits `pending` deposits once confirmed on-chain (reverted → `failed`, no credit);
4. purges expired fee quotes.
Alert on log lines containing `ALERT:` and on `/ready` showing `reconciler.lastOk=false` or a stale `lastRunAt`.

## Handling `needs_review` (admin API, `X-Admin-Key` + `X-Admin-Actor` headers, private network only)
`GET /admin/withdrawals/review` → for each item find out, **outside this system** (Privy dashboard/logs, block explorer
for the user's wallet address), whether a transfer was broadcast.
- Found on-chain → `POST /admin/withdrawals/:id/resolve {"action":"confirm","txHash":"0x…","note":"…"}`; the reconciler then settles it from the chain.
- Provably not broadcast → `{"action":"refund","note":"…"}`. This is irreversible; the DB blocks a second refund.
Every action is written to `admin_actions`.

## Daily checks
- `GET /admin/reconciliation`: `ok` must be `true` (balance = sum of ledger entries). Compare `liabilities` per asset
  with the actual on-chain totals of all user wallets; any shortfall is an incident.
- `stuckOver15Min` should be empty.
- KYC: `POST /admin/users/:id/kyc`. Sanctions/blocklist: `POST /admin/blocked-addresses`.

## Incident levers
`ZIARAT_WITHDRAWALS_ENABLED=false` + restart halts all withdrawals instantly. Rotate `PRIVY_APP_SECRET`,
`PRIVY_AUTHORIZATION_PRIVATE_KEY` and `ADMIN_API_KEY` after any suspected leak.

## Database hygiene
Run the API with a DB role that has **no** `DELETE`/`TRUNCATE`/`UPDATE` on `ledger_entries`, and no DDL rights. Enable PITR backups
and test a restore.

## Revenue (crypto withdrawal fees)
- Fee = ceil(amount x bps / 10000), clamped to [min, max], charged **on top** of the amount (recipient gets the full amount).
  It is debited from the user and credited to the treasury account in the same DB transaction as the withdrawal.
  Failed/refunded withdrawals return the fee and reverse the treasury income.
- Pricing: `GET/PUT /admin/crypto-fees` (human units, audited). **Seeded rates are placeholders (0.50%, USDT/USDC min 1 max 25,
  ETH min 0.0005 max 0.05, ZIAR off): approve or change them before enabling withdrawals.** Keep the fee above your real cost
  (gas if you sponsor it, plus Privy charges).
- Reporting: `GET /admin/revenue` (treasury balance and 30-day fee income). Treasury funds are ledger entries; moving them to a
  company wallet needs a deliberate, audited process that does not exist in the API yet (by design: no API path drains the treasury).
- All withdrawals touch one treasury row per asset, which serializes that tiny step; fine at early volume, revisit at scale.
