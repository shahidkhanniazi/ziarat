# Ziarat Fee Engine v1

## Included
- PostgreSQL tables for fee services, fee rules, and expiring fee quotes.
- 11 service categories: wallet transfer, international transfer, FX conversion, crypto swap, crypto deposit, crypto withdrawal, merchant payment, payment link, business payout, bill payment, and card transaction.
- Rule fields: percentage fee (basis points), fixed fee (USD cents), minimum fee, maximum fee, estimated provider cost percentage and fixed component.
- API: `GET /v1/fees/services`; `POST /v1/fees/quote`.
- Quote lifetime: 300 seconds. Quote endpoint is informational only and does not collect or debit funds.

## Pricing safety
All services are disabled by default and no commercial rates are seeded. Do not enable a service until Ziarat approves pricing and provider costs. Rates should be configured by a restricted database/admin workflow; public rule-edit endpoints are intentionally not included.

## Apply migration
Run `db/002_fee_engine.sql` after `db/001_init.sql` in the target PostgreSQL database.

## Quote example
Request body: `{ "serviceCode": "international_transfer", "amount": "100.00", "currency": "USD" }`

A quote is returned only when the service is enabled and has a configured fee rule. Otherwise the API returns a clear disabled/unconfigured error. Provider integrations and actual transaction fee collection are outside this fee-engine foundation.
