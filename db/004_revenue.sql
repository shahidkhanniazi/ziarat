-- Ziarat revenue v1: crypto-withdrawal fee collection. Apply after 003_hardening.sql. Safe to re-run.

-- Treasury = the ledger account that holds earned fees. No API path withdraws from it.
INSERT INTO users (external_user_id, kyc_status) VALUES ('ziarat:treasury', 'approved') ON CONFLICT (external_user_id) DO NOTHING;

ALTER TABLE crypto_transactions ADD COLUMN IF NOT EXISTS fee_minor numeric(78,0) NOT NULL DEFAULT 0 CHECK (fee_minor >= 0);

-- Fee rule per asset (asset-denominated, minor units). fee = ceil(amount * bps / 10000), clamped to [min, max].
CREATE TABLE IF NOT EXISTS crypto_fee_rules (
  asset          text PRIMARY KEY,
  percentage_bps integer NOT NULL CHECK (percentage_bps BETWEEN 0 AND 2000),
  min_fee_minor  numeric(78,0) NOT NULL DEFAULT 0 CHECK (min_fee_minor >= 0),
  max_fee_minor  numeric(78,0) CHECK (max_fee_minor IS NULL OR max_fee_minor >= min_fee_minor),
  enabled        boolean NOT NULL DEFAULT false,
  updated_by     text NOT NULL DEFAULT 'migration',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- PLACEHOLDER launch pricing (0.50%, with floors/caps) - review and change via PUT /admin/crypto-fees before launch.
-- Withdrawals are off by default, so nobody is charged until ZIARAT_WITHDRAWALS_ENABLED=true.
INSERT INTO crypto_fee_rules (asset, percentage_bps, min_fee_minor, max_fee_minor, enabled) VALUES
  ('USDT', 50, 1000000, 25000000, true),                         -- 0.50%, min 1 USDT, max 25 USDT (6 decimals)
  ('USDC', 50, 1000000, 25000000, true),
  ('ETH',  50, 500000000000000, 50000000000000000, true),      -- 0.50%, min 0.0005 ETH, max 0.05 ETH (18 decimals)
  ('ZIAR', 0,  0, NULL, false)                                   -- token: no fee until tokenomics/fee-discount rules are final
ON CONFLICT (asset) DO NOTHING;

-- The fee on a transaction can never change after creation.
CREATE OR REPLACE FUNCTION crypto_tx_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.asset <> OLD.asset OR NEW.network <> OLD.network
     OR NEW.type <> OLD.type OR NEW.amount_minor <> OLD.amount_minor OR NEW.fee_minor <> OLD.fee_minor THEN
    RAISE EXCEPTION 'crypto_transactions money fields are immutable';
  END IF;
  IF OLD.status IN ('confirmed','failed') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'crypto_transactions status % is final', OLD.status;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
