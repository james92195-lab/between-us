# Between Us

Interest-free loans between friends, plus a jar for the spare change.

Someone pays. The bill splits evenly. Each share can round up to the next dollar, and that extra sits in a jar you give to a cause you name. Paybacks are recorded. Nobody is charged interest.

The sample circle (you, Maya, Jonah, Priya) is there so the books aren’t empty. Start a blank circle from the Circle tab. Everything stays in the browser on that device.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:8080

## Sell hosting, not the loans

Loans stay at zero interest. Charge for keeping the circle: hosting, upkeep, your time.

1. On the **Sell** tab, paste an `https://` payment link you already use (Stripe Payment Link, Ko-fi, GitHub Sponsors, or Venmo).
2. Set a price (once or monthly) and a short sentence about what they’re paying for.
3. Copy the offer and send it the way you already talk to the circle.

This project does not process cards.

### Example offer you can copy

> Between Us  
> $8.00 a month to keep our circle hosted.  
> Hosting, backups, and the occasional quiet fix so the books stay simple.  
> https://buy.stripe.com/your-link  
>
> [the current books are attached automatically when you copy from the app]

Licensed under **AGPL-3.0**.

- You can sell the software, offer a hosted version, or charge for support.
- If you run a modified copy as a service, people who use it can ask you for the source.
- AGPL is a poor fit if you want to sell a closed version. Pick another license before you do that.

## Deploy from GitHub

1. This repo is the app. Connect it to [Vercel](https://vercel.com) and import the project (Nitro preset is already set).
2. You do not need a database for the ledger. Balances live on the device. Download `between-us.json` from the Sell tab if you want a backup.
3. CI (typecheck + tests + build) runs on every push and pull request.

After it is live you can put the URL on the Sell tab and start charging for hosting.

## What’s in the book

- Circles of friends
- Shared bills, paybacks, and a transaction log
- A change jar you mark as given when you actually donate
- An offer you can send when you want to charge for hosting
