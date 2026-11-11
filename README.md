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

## Run it on GitHub

The public site is live at [james92195-lab.github.io/between-us](https://james92195-lab.github.io/between-us/).

Pushing to `main` rebuilds that copy. Pages is already set to **GitHub Actions** (`pages` workflow, artifact `dist/pages-site`). If a later deploy 404s, that source switch is the one setting to check.

Books stay in the browser. You do not need a database.

```bash
npm install
npm run dev          # local preview
npm run build:pages  # the static site GitHub Pages serves
```

## Sell hosting, not the loans

Loans stay at zero interest. Charge for keeping the circle: hosting, upkeep, your time.

1. On the **Sell** tab, paste an `https://` payment link you already use (Stripe Payment Link, Ko-fi, GitHub Sponsors, or Venmo).
2. Set a price (once or monthly) and a short sentence about what they’re paying for.
3. **Copy public link.** That URL is the thing you sell. Whoever opens it on the GitHub Pages site sees a Pay button. The price rides in the link — there is no server to store it.
4. Copy or email the longer offer if you also want the current books in the message.

This project does not process cards. Paying is optional — the app does not lock the books behind a paywall.

### Example offer you can copy

> Between Us  
> $8.00 a month to keep our circle hosted.  
> Hosting, backups, and the occasional quiet fix so the books stay simple.  
> Pay: https://buy.stripe.com/your-link  
> Open the app: https://james92195-lab.github.io/between-us/

Licensed under **AGPL-3.0**.

- You can sell the software, offer a hosted version, or charge for support.
- If you run a modified copy as a service, people who use it can ask you for the source.
- AGPL is a poor fit if you want to sell a closed version. Pick another license before you do that.

## Your own domain

Import this repo on [Vercel](https://vercel.com) if you want a custom domain (the Nitro preset is already set). GitHub Pages is the free public copy. Download `between-us.json` from the Sell tab if you want a backup.

CI (typecheck + tests + build) runs on every push and pull request.

## What’s in the book

- Circles of friends
- Shared bills, paybacks, and a transaction log
- A change jar you mark as given when you actually donate
- An offer you can send when you want to charge for hosting
