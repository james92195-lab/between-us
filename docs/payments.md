# Payments

Between Us can record loans and jar decisions on one device. It does not move money.

The only payment processor this codebase targets is [Dwolla](https://developers.dwolla.com/docs/transfer-money-between-users) for US bank-to-bank ACH. Stripe and PayPal are not integrated. This is not Circle (the USDC company) and there is no crypto.

## What works with no secrets

- The loan book: create a loan, open it, write a manual repayment, void it. Amounts are integer cents.
- The shared jar notebook: members, a goal, recorded promises, and the 3-person withdrawal vote.
- `POST /api/jars/withdrawals` recomputes that vote and always answers `fundsMoved: false`. A client flag that says the transfer succeeded is ignored.
- `GET /api/payments/status` reports the gates without echoing secrets.
- `POST /api/payments/dwolla/webhook` checks the `X-Request-Signature-SHA-256` HMAC of the raw body. A bad signature is HTTP 401. A good signature is acknowledged and applied to nothing: no jar credit, no loan repayment.

## What stays off

Dwolla’s own guide says peer-to-peer transfers need a risk review before you build. Between Us has no written approval. The launch country is not confirmed. Dwolla ACH in this adapter is US-only.

Sandbox dispatch code exists (`POST https://api-sandbox.dwolla.com/transfers` with `Idempotency-Key`, HAL content type, and an amount string built from server cents). The HTTP routes never call it. Production is refused even if every flag is set. Calling the helper also refuses unless all of these are present in the server environment, and even then a successful HTTP response does not mark a loan repaid or a jar funded:

| Variable | Required value | Purpose |
| --- | --- | --- |
| `DWOLLA_ENVIRONMENT` | `sandbox` | Production is hard-refused. |
| `DWOLLA_CLIENT_ID` | from the Dwolla dashboard | Never commit it. |
| `DWOLLA_CLIENT_SECRET` | from the Dwolla dashboard | Never commit it. |
| `DWOLLA_WEBHOOK_SECRET` | the subscription secret | HMAC only. |
| `DWOLLA_PLAID_EXCHANGE_PARTNER_HREF` | href from `GET /exchange-partners` | Bank linking, not typed account numbers. |
| `DWOLLA_P2P_APPROVAL` | `written-approval-on-file` | Only after Dwolla’s written yes. |
| `DWOLLA_LAUNCH_COUNTRY` | `US` | Unset until that is true. |
| `DWOLLA_SANDBOX_DISPATCH` | `enabled` | Extra arming switch. Still not used by the routes. |

Do not create a Dwolla account, accept their terms, or run a sandbox transfer from this repo’s workflow.

Bank linking, when it is eventually allowed, follows Dwolla’s Open Banking exchange session for Plaid (`_links.exchange-partner` only). The app must not collect routing or account numbers. Plaid Link is hosted by Plaid. It is not embedded here.

## Shared jar is not a Dwolla wallet

Dwolla documents that account-to-account transfers pass through a Dwolla wallet, explicitly or implicitly. That is Dwolla’s network hop, not this jar. Labels, balance funding sources, and virtual account numbers are not implemented. `jarDispatchAllowed()` always fails with `jar_custody_not_approved`.

## Hosting

GitHub Pages can keep serving the static book. It cannot verify webhooks or hold API secrets.

A later host needs:

- HTTPS server (the repo’s Nitro build is aimed at Vercel, but nothing here is deployed).
- Auth turned on for real, with every payment row scoped to the verified user. Do not use the preview dev user.
- A private database of customers, funding-source URLs, transfer ids, correlation ids, and webhook event ids. Idempotency keys expire at Dwolla after 24 hours; the ledger still has to refuse a second spend.
- Server-authoritative amounts. The browser sends a loan or withdrawal id. The server reads the cents.
- No card data, ever.

Until that host, the signed-in membership ledger, and Dwolla’s written approval all exist, transfers stay disabled.
