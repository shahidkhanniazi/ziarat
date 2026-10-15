-- Ziarat fee engine v1. Apply after db/001_init.sql.
-- Services are disabled and fee rules are unconfigured by default. Finance/product must approve rates before activation.
CREATE TABLE IF NOT EXISTS fee_services (
  code text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, currency)
);
CREATE TABLE IF NOT EXISTS fee_rules (
  service_code text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  percentage_bps integer NOT NULL CHECK (percentage_bps BETWEEN 0 AND 10000),
  fixed_minor numeric(20,0) NOT NULL DEFAULT 0 CHECK (fixed_minor >= 0),
  minimum_minor numeric(20,0) CHECK (minimum_minor IS NULL OR minimum_minor >= 0),
  maximum_minor numeric(20,0) CHECK (maximum_minor IS NULL OR maximum_minor >= 0),
  provider_cost_bps integer NOT NULL DEFAULT 0 CHECK (provider_cost_bps BETWEEN 0 AND 10000),
  provider_cost_fixed_minor numeric(20,0) NOT NULL DEFAULT 0 CHECK (provider_cost_fixed_minor >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_code, currency),
  FOREIGN KEY (service_code, currency) REFERENCES fee_services(code, currency),
  CHECK (maximum_minor IS NULL OR minimum_minor IS NULL OR maximum_minor >= minimum_minor)
);
CREATE TABLE IF NOT EXISTS fee_quotes (
  id uuid PRIMARY KEY,
  service_code text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD',
  amount_minor numeric(20,0) NOT NULL CHECK (amount_minor > 0),
  fee_minor numeric(20,0) NOT NULL CHECK (fee_minor >= 0),
  provider_cost_minor numeric(20,0) NOT NULL CHECK (provider_cost_minor >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (service_code, currency) REFERENCES fee_services(code, currency)
);
CREATE INDEX IF NOT EXISTS fee_quotes_expiry ON fee_quotes(expires_at);

INSERT INTO fee_services (code, name, description, sort_order) VALUES
 ('wallet_transfer','Wallet transfer','Transfer between supported Ziarat wallets',10),
 ('international_transfer','International transfer','Cross-border money transfer',20),
 ('fx_conversion','FX conversion','Convert between supported fiat currencies',30),
 ('crypto_swap','Crypto swap','Swap supported digital assets',40),
 ('crypto_deposit','Crypto deposit','Deposit supported digital assets',50),
 ('crypto_withdrawal','Crypto withdrawal','Withdraw supported digital assets',60),
 ('merchant_payment','Merchant payment','Pay a supported merchant',70),
 ('payment_link','Payment link','Receive payment through a payment link',80),
 ('business_payout','Business payout','Payout to a supported recipient',90),
 ('bill_payment','Bill payment','Pay a supported biller',100),
 ('card_transaction','Card transaction','Transaction using a supported Ziarat card',110)
ON CONFLICT (code, currency) DO NOTHING;
