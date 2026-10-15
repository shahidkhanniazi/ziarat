-- Ziarat wallet schema (v2). Run once on a fresh database.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_user_id text UNIQUE NOT NULL,            -- Privy user id (did:privy:...)
  -- Set to 'approved' by your KYC process (manually or via your KYC provider integration).
  kyc_status       text NOT NULL DEFAULT 'unverified'
                   CHECK (kyc_status IN ('unverified','pending','approved','rejected')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  provider           text NOT NULL,
  provider_wallet_id text NOT NULL,
  chain_type         text NOT NULL,                  -- 'ethereum' (one wallet serves every EVM chain)
  address            text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_wallet_id),
  UNIQUE (user_id, chain_type)
);
CREATE UNIQUE INDEX IF NOT EXISTS wallets_address_lower ON wallets (lower(address));

-- Current balance per user/asset/network. network = CAIP-2 id, e.g. eip155:1
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  asset         text NOT NULL,
  network       text NOT NULL,
  balance_minor numeric(78,0) NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset, network)
);

-- Append-only audit trail of every balance movement.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  asset         text NOT NULL,
  network       text NOT NULL,
  direction     text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_minor  numeric(78,0) NOT NULL CHECK (amount_minor > 0),
  balance_after numeric(78,0) NOT NULL,
  reason        text NOT NULL,                       -- deposit | withdrawal | withdrawal_refund
  ref_id        text,                                -- crypto_transactions.id
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_user ON ledger_entries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crypto_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  asset             text NOT NULL,
  network           text NOT NULL,
  type              text NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount_minor      numeric(78,0) NOT NULL CHECK (amount_minor > 0),
  -- withdrawal lifecycle: pending -> submitted -> confirmed | failed ; needs_review = outcome unknown
  status            text NOT NULL CHECK (status IN ('pending','submitted','confirmed','failed','needs_review')),
  address           text,
  tx_hash           text,
  provider_event_id text UNIQUE,                     -- Privy idempotency_key for deposits
  idempotency_key   text,                            -- client key for withdrawals
  request_hash      text,                            -- fingerprint of the withdrawal request
  failure_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS crypto_tx_user_created ON crypto_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crypto_tx_hash ON crypto_transactions (tx_hash);
CREATE INDEX IF NOT EXISTS crypto_tx_open ON crypto_transactions (status) WHERE status IN ('pending','needs_review');

CREATE TABLE IF NOT EXISTS webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text NOT NULL,
  event_id    text NOT NULL,
  payload     jsonb NOT NULL,
  outcome     text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
