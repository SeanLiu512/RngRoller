# Rollr — self-hosted

This app was originally exported from Base44 and has been migrated off it.
It's now a normal Express + Postgres backend (in `/server`, deployed as a
Vercel serverless function) serving a Vite/React frontend, with no
dependency on Base44 at all.

## Architecture

- **Frontend**: Vite + React (unchanged from the original app), in `src/`.
- **Backend**: Express + Prisma + PostgreSQL, in `server/`. Handles auth
  (JWT-based, with email verification codes), the `Roll` / `ArenaMatch` /
  `User` data that used to live in Base44's hosted database, and image
  uploads (stored as base64 in Postgres).
- On Vercel, `api/index.js` exposes that same Express app as a single
  serverless function (see `vercel.json`), and Vercel serves the built
  frontend (`dist/`) as static files alongside it.
- Email (verification codes, password reset links) is sent via Resend's
  HTTP API rather than SMTP — most serverless/PaaS hosts block outbound
  SMTP ports, but a plain HTTPS call always works.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in at least `DATABASE_URL` and
   `JWT_SECRET`. For local Postgres, something like:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rollr"
   JWT_SECRET="<openssl rand -hex 32>"
   APP_URL="http://localhost:5173"
   ```
   Everything else (Resend) is optional for local dev — see below.
3. Create the database tables:
   ```bash
   npm run db:migrate
   ```
4. Run the backend and frontend in two terminals:
   ```bash
   npm run server:dev   # backend on :4000
   npm run dev           # frontend on :5173, proxies /api to :4000
   ```

## Deploying to Vercel

### 1. Database: Neon (free, serverless-friendly Postgres)

Vercel's functions are serverless, so the database needs to support many
short-lived connections — [Neon](https://neon.tech) is built for exactly
this and has a generous free tier.

1. Sign up at neon.tech, create a project.
2. In the Neon dashboard, copy the **pooled** connection string (it has
   `-pooler` in the hostname) — this matters, a non-pooled string will run
   out of connections under normal use.

### 2. Deploy the app

1. Push this repo to GitHub (if you haven't already).
2. Go to https://vercel.com → **Add New** → **Project** → import your
   GitHub repo.
3. Vercel auto-detects Vite; you don't need to change the framework preset,
   since `vercel.json` already overrides the build command.
4. Before deploying, add these **Environment Variables** (Project Settings
   → Environment Variables):
   - `DATABASE_URL` — the Neon pooled connection string from step 1
   - `JWT_SECRET` — any long random string (`openssl rand -hex 32`, or see
     the "generate one without npm" tips below)
   - `APP_URL` — your Vercel domain, e.g. `https://your-app.vercel.app`
     (you'll only know this after the first deploy — update it after and
     redeploy)
   - `ADMIN_EMAIL` — the email that should get admin access on sign-up
   - `RESEND_API_KEY` — from resend.com, see below
   - `RESEND_FROM` — `onboarding@resend.dev` works with no setup, or an
     address on a domain you've verified in Resend
5. Click **Deploy**.

### 3. Email: Resend

1. Sign up at https://resend.com (free tier: 3,000 emails/month).
2. **API Keys** → **Create API Key** → copy it into `RESEND_API_KEY` above.
3. `RESEND_FROM=onboarding@resend.dev` works immediately with no extra
   setup; add your own domain in Resend's dashboard later if you want mail
   from your own address.

### Generating `JWT_SECRET` without npm/node installed

- Mac/Linux terminal: `openssl rand -hex 32`
- Browser console (F12 → Console), any OS:
  ```js
  [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2,'0')).join('')
  ```

## Migrating your existing data from Base44

If you still have your old Base44 app, you can pull its data into this
database:

1. In the Base44 dashboard, open **Data**, then export each of these
   tables to CSV: `User`, `Roll`, `ArenaMatch`.
2. Put the three CSV files in a folder, e.g. `migration-data/` in this
   project (keep the exact filenames `Users.csv`, `Roll.csv`,
   `ArenaMatch.csv`).
3. Run, with `DATABASE_URL` pointed at your Neon database:
   ```bash
   node server/scripts/import-from-base44.js ./migration-data
   ```
4. Base44 never exposes password hashes (correctly — that's a security
   boundary, not a bug), so migrated accounts come in **without** a
   password. Tell your existing users to use **Forgot password** on the
   login page once, to set a password for the first time here. Their email,
   role, badges, EP, and full roll/arena history carry over automatically.

## What changed from the Base44 export

- `base44/` (entity schema definitions) is now mirrored in
  `server/prisma/schema.prisma`.
- `src/api/base44Client.js` and every page's injected `__B44_DB__` stub were
  replaced by `src/api/client.js`, a small fetch-based client with the same
  shape (`db.auth.*`, `db.entities.*`, `db.integrations.Core.UploadFile`), so
  the page components themselves needed no changes.
- `src/lib/AuthContext.jsx` was simplified to talk to the new backend
  directly instead of Base44's app-settings endpoints.
- Registration is email-first: you request a code, then submit the code
  together with your chosen password to finish creating the account.
- The unused `@base44/sdk` / `@base44/vite-plugin` / Stripe dependencies
  were removed (Stripe was present in `package.json` but never actually
  wired into any page). Google login was also removed.
- The backend (`server/app.js`) can run either as a traditional long-lived
  Node process (`server/index.js`, for Railway/Render/etc.) or as a single
  Vercel serverless function (`api/index.js`) — same code, two entry points.
