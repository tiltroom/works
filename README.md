# Hours Platform (Next.js + Supabase + Stripe)

Role-based platform for tracking project working hours:

- **Admin**: invites users, creates projects, assigns each project to one customer, assigns workers to projects.
- **Customer**: sees own projects, assigned vs used hours, detailed time usage, buys more hours with Stripe.
- **Worker**: sees assigned projects, starts/stops timer, and adds manual time entries.

## Tech stack

- Next.js (App Router)
- Supabase (`@supabase/ssr` + Postgres + RLS)
- Stripe Checkout + webhook fulfillment
- Tailwind CSS

## 1) Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PER_HOUR_CENTS=5000
STRIPE_CURRENCY=usd
```

## 2) Supabase database + RLS

Run SQL from the base schema, then apply the dated migration files in `supabase/` in filename order:

```bash
supabase/schema.sql
supabase/2026-*.sql
```

This creates:

- `profiles` with role (`admin`, `customer`, `worker`)
- `projects` (one `customer_id` per project)
- `project_workers` (many workers per project)
- `time_entries` (timer/manual)
- `hour_purchases` (Stripe-purchased hours ledger)
- `processed_stripe_events` and `apply_hour_purchase` for idempotent fulfillment

## 3) Stripe webhook

Create webhook endpoint in Stripe:

```text
http://localhost:3000/api/stripe/webhook
```

Subscribe to:

- `checkout.session.completed`

Use the signing secret as `STRIPE_WEBHOOK_SECRET`.

## 4) Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## 5) Main routes

- `/login` (magic-link only), `/signup` (invite notice)
- `/admin`
- `/customer`
- `/worker`
- `/api/stripe/webhook`

Route access is enforced via `src/proxy.ts` + role checks and Supabase RLS.

## Invite-only authentication

- Login is passwordless magic-link only.
- Only emails pre-invited by admin can request a magic link.
- Invitations are stored in `public.invitations`.
- New users are accepted only if an invitation exists; role and optional name are applied from invitation.
