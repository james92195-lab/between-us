# Between Us

Interest-free loans between friends, and a shared jar for money the circle means to pool.

Sign in with email and password. A circle is a group of those accounts. Loans, promised jar contributions, and withdrawal votes are stored in the database and tied to the signed-in member. The offline notebook is a separate on-device book and is not an account.

The book does not send bank transfers. Amounts are integer cents. A repayment you type is labeled as written down, not as a provider confirmation. Jar promises are not a spendable balance.

“Circle” means that friends group, not a crypto network.

## Jar votes

A withdrawal needs yeses from **3 other active members of that jar**. The requester cannot approve it. Changing the amount, destination, or purpose voids those yeses. If fewer than 3 other active members exist, voting is blocked and the threshold stays 3. Three yeses mean the policy passed. They do not move money.

Custody of a real pooled jar is still undecided. See [docs/shared-jar.md](docs/shared-jar.md).

## Payments

US bank-to-bank transfers are aimed at Dwolla, and only after Dwolla’s peer-to-peer review. Nothing in this repo calls Dwolla, creates an account, or holds API keys. Live and sandbox sends stay off. See [docs/payments.md](docs/payments.md).

## Sell hosting

Loans stay at zero interest. Charge for keeping the circle: hosting, upkeep, your time.

1. On the **Sell** tab, paste an `https://` payment link you already use (Stripe Payment Link, Ko-fi, GitHub Sponsors, or Venmo).
2. Set a price (once or monthly) and a short sentence about what they’re paying for.
3. **Copy public link.** That URL is the thing you sell. Whoever opens it on the GitHub Pages site sees a Pay button. The price rides in the link — Pages does not store it.
4. Copy or email the longer offer if you also want the sentence in the message.

This project does not process cards. Paying is optional. The Pay button is for hosting, not a loan or a jar withdrawal.

## Running locally

```bash
npm install
npm test
npm run dev
```

```bash
npm run build:pages
```

That builds the static site GitHub Pages serves at [james92195-lab.github.io/between-us](https://james92195-lab.github.io/between-us/). Pushing to `main` rebuilds it. Pages is already set to **GitHub Actions**. The static copy is the offline notebook plus hosting-offer links. Sign-in and shared votes need a server with `DATABASE_URL` and `VITE_AUTH_ENABLED=true`.

## Host on Render

Sign in to Render with GitHub, choose **New > Blueprint**, pick this repo, and click **Apply**. The service is `https://between-us.onrender.com` unless that name is taken. Steps, the free-database expiry, and the one-click link are in [docs/deploy-render.md](docs/deploy-render.md). Pages keeps working as the offline notebook.

## License

Copyright (C) 2026 James Stevens

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version (AGPL-3.0-or-later).

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

The license text is [LICENSE](LICENSE).

## Third-party notes

- Outfit and Fraunces are loaded from Google Fonts. Both are under the SIL Open Font License 1.1.
- lightningcss is MPL-2.0.
- caniuse-lite is CC-BY-4.0.

These files are Grok App Builder scaffolding. The app uses them (home-screen icon and the install page). Their license is not stated, and the AGPL grant above does not cover them:

- `public/__grok/icon-180.png`
- `public/__grok/install/assets/homescreen/logo-grok.svg`
- `public/__grok/install/assets/homescreen/glass-puzzle.svg`
- `public/__grok/install/assets/homescreen/glass-share.svg`
- `public/__grok/install/assets/homescreen/plus.svg`
- `public/__grok/install/assets/homescreen/ob-ipad.png`
- `public/__grok/install/assets/homescreen/ob-phone.png`
