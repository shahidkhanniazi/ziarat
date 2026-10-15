-- Ziarat hardening v1. Apply after 001_init.sql and 002_fee_engine.sql. Safe to re-run.

-- 1) A given movement can only be written once: one deposit credit, one withdrawal debit, one refund per transaction.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_once ON ledger_entries (reason, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_entries_account ON ledger_entries (user_id, asset, network);

-- 2) The audit trail is append-only at the database level (not only by application convention).
CREATE OR REPLACE FUNCTION ledger_entries_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'ledger_entries is append-only'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS ledger_entries_no_mutation ON ledger_entries;
CREATE TRIGGER ledger_entries_no_mutation BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_immutable();

-- 3) Money-relevant columns of a transaction can never change, and terminal states are final (blocks double refunds).
CREATE OR REPLACE FUNCTION crypto_tx_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.asset <> OLD.asset OR NEW.network <> OLD.network
     OR NEW.type <> OLD.type OR NEW.amount_minor <> OLD.amount_minor THEN
    RAISE EXCEPTION 'crypto_transactions money fields are immutable';
  END IF;
  IF OLD.status IN ('confirmed','failed') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'crypto_transactions status % is final', OLD.status;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS crypto_tx_guard_trg ON crypto_transactions;
CREATE TRIGGER crypto_tx_guard_trg BEFORE UPDATE ON crypto_transactions
  FOR EACH ROW EXECUTE FUNCTION crypto_tx_guard();

CREATE INDEX IF NOT EXISTS crypto_tx_open_all ON crypto_transactions (status, updated_at)
  WHERE status IN ('pending','submitted','needs_review');

-- 4) Operator audit trail + screening list.
CREATE TABLE IF NOT EXISTS admin_actions (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,
  action     text NOT NULL,
  target     text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS blocked_addresses (
  address    text PRIMARY KEY CHECK (address = lower(address)),
  reason     text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Fee quotes are tied to the authenticated user.
ALTER TABLE fee_quotes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
