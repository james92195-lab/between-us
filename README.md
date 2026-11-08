# Between Us

Interest-free loans between friends, plus a jar for the spare change.

Someone pays. The bill splits evenly. Each share can round up to the next dollar, and that extra sits in a jar you give to a cause you name. Paybacks are recorded. Nobody is charged interest.

The sample circle (you, Maya, Jonah, Priya) is there so the books aren’t empty. Start a blank circle from the Circle tab. Everything stays in the browser on that device.

## Running locally

```bash
npm install
npm run dev
```

## Sell hosting, not the loans

Loans stay at zero interest. Charge for keeping the circle: hosting, upkeep, your time.

1. On the Sell tab, paste an `https://` payment link you already use (Stripe Payment Link, Ko-fi, GitHub Sponsors, or Venmo).
2. Set a price, once or monthly, and a sentence about what they’re paying for.
3. Copy the offer and send it.

This project does not process cards.

Licensed under **AGPL-3.0**.

- You can sell the software, offer a hosted version, or charge for support.
- If you run a modified copy as a service, people who use it can ask you for the source.
- AGPL is a poor fit if you want to sell a closed version. Pick another license before you do that.

## Deploy

1. This repo is the app.
2. Connect it to Vercel and import the project.
3. You do not need a database for the ledger. Balances live on the device. Download `between-us.json` from the Sell tab if you want a backup.

## What’s in the book

- Circles of friends
- Shared bills, paybacks, and a transaction log
- A change jar you mark as given when you actually donate
- An offer you can send when you want to charge for hosting
