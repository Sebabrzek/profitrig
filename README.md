# ProfitRig

Owner-Operator Cost Per Mile calculator. Mobile-first PWA. Built for drivers who aren't tech savvy: big inputs, big numbers, plain English.

**Stage 1 (this repo):** Each driver creates an account and gets a saved cost profile. The app calculates true cost per mile (CPM), the minimum target rate, break-even monthly revenue, and projected monthly profit — live, as they type.

**Stage 2 (next):** Weekly load tracker that uses the saved CPM to flag profitable vs. losing loads.

---

## One-time setup

### 1. Supabase — create the database table

1. Open your Supabase project: <https://qgwzxvqrpuodvuovxkcn.supabase.co>
2. Left sidebar → **SQL Editor** → **New query**
3. Open the file `supabase-setup.sql` in this repo, copy the whole contents into the editor, click **Run**.
4. (Optional but recommended for testing) Left sidebar → **Authentication** → **Sign In / Up** → toggle **off** "Confirm email" so you can sign up and use the app immediately without checking email. Turn it back on for production.

### 2. Vercel — deploy

1. Go to <https://vercel.com/new> and import `Sebabrzek/profitrig`.
2. On the **Configure Project** screen, expand **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://qgwzxvqrpuodvuovxkcn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your publishable key (`sb_publishable_...`)
3. Click **Deploy**. Vercel will give you a free `*.vercel.app` URL — that's your live app.
4. Later: add a custom domain (`profitrig.com`) in **Project → Settings → Domains**.

### 3. Supabase — add the Vercel URL to allowed redirect URLs

1. Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel URL (e.g. `https://profitrig.vercel.app`)
3. Add the same URL to **Redirect URLs**.

---

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Sign up with any email/password (must be 6+ chars), then you'll land on the calculator.

`.env.local` already contains your Supabase URL + key.

---

## What's in the box

- `src/app/page.tsx` — main calculator screen (server component, auth-gated, loads saved profile)
- `src/app/Calculator.tsx` — interactive form + live results
- `src/app/login/` — sign in / sign up
- `src/app/actions.ts` — server actions (sign in, sign up, sign out, save profile)
- `src/lib/supabase/` — Supabase clients (browser, server, middleware)
- `src/middleware.ts` — refreshes the user session on every request, redirects to /login if not signed in
- `supabase-setup.sql` — the database schema + row-level-security policies (run this once in Supabase)
- `public/manifest.webmanifest` + `public/icons/` — PWA config, "Add to Home Screen" works

## Stage 2 plan (load tracker)

Add `loads` table keyed by `user_id` with: date, broker, miles, rate paid, optional fuel cost, profit/loss vs. saved CPM, week aggregates. Same auth, same shadcn-style UI. Will reuse the saved `cost_profiles` row.
