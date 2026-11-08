# Between Us

App to loan money between friends with a money jar to donate change.

## Features
- Circles of friends for shared lending
- Track loans / IOUs ("marks")
- Money jar for spare change donations
- Transaction log
- Sell / marketplace elements (WIP)

## Running Locally
```bash
npm install
npm run dev
```

## Deploying to GitHub + Vercel (recommended)
1. Push this repo to GitHub (already done if you're reading this).
2. Connect the repo to Vercel: import project at vercel.com.
3. Set environment variables if using a real DB (Postgres via Vercel or Neon).
4. The app uses Nitro preset for Vercel and falls back to PGLite for local/dev.

The build outputs to `.vercel/output` and can be deployed with `npx nitro deploy --prebuilt`.

## Selling the App
This project is licensed under AGPL-3.0.
- You can sell the software, offer hosted versions, or charge for support.
- AGPL requires that users of a modified network version can access the corresponding source code.
- Perfect for open-source commercial models (e.g., sell a hosted SaaS while providing source).

## Tech Stack
- TanStack Start / React Router
- Vite
- Nitro (Vercel)
- Zustand for state
- Zod for validation
- Tailwind CSS
