# Between Us

Interest-free loans between friends, and a shared jar for money the circle means to pool.

Sign in with email and password. A circle is a group of those accounts. Loans, promised jar contributions, and withdrawal votes are stored in the database and tied to the signed-in member. The offline notebook is a separate on-device book and is not an account.

The book does not send bank transfers. Amounts are integer cents. A repayment you type is labeled as written down, not as a provider confirmation. Jar promises are not a spendable balance.

Friends do not share an account here. Names in the circle are not logins. “Circle” means that friends group, not a crypto network.

## Jar votes

A withdrawal needs yeses from **3 other active members of that jar**. The requester cannot approve it. Changing the amount, destination, or purpose voids those yeses. If fewer than 3 other active members exist, voting is blocked and the threshold stays 3. Three yeses mean the notebook policy passed. They do not move money.

Custody of a real pooled jar is still undecided. See [docs/shared-jar.md](docs/shared-jar.md).

## Payments

US bank-to-bank transfers are aimed at Dwolla, and only after Dwolla’s peer-to-peer review. Nothing in this repo calls Dwolla, creates an account, or holds API keys. Live and sandbox sends stay off. See [docs/payments.md](docs/payments.md).

## Running locally

```bash
npm install
npm run dev
```

Open the preview this workspace serves. `npm test` covers the money math, loan limits, the 3-person vote, and the Dwolla gate.

```bash
npm run build:pages
```

That builds the static book GitHub Pages can host. Pages cannot verify Dwolla webhooks or keep secrets. The live site changes only when `main` is updated. This branch does not deploy itself.

## Data

The book is stored in this browser under `between-us-book`. Download it from the Circle tab. Replacing the book from a file rejects anything that claims a bank already confirmed a contribution or a repayment.
