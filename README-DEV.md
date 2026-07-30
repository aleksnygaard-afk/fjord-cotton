# Fjord & Cotton — developer README

Print-on-demand t-shirt store for the Norwegian/Nordic market. A large,
filterable, seasonally-merchandised catalogue (~10 new designs/day, growing into
the thousands) with self-hosted checkout and fulfilment.

This is the implementation of the handoff in **`README.md`** and **`01`–`05`**
(design spec, data model, API/payments, Gelato, Norwegian compliance). Read those
for the *why*; read this for the *what was built* and *how it fits together*.

> **Status: all 7 build-order steps implemented.** What remains is operational
> configuration (real API keys, Gelato product UIDs, VAT registration, EU-region
> deploy). See **`SETUP.md`** for setup, testing and the go-live checklist.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, React 19 |
| Styling | Design tokens in `app/globals.css` (inline styles + a few utility classes) |
| Database | Postgres via Supabase (RLS; anon reads, service-role writes) |
| Storage | Supabase Storage — `print-files` (private), `mockups` (public) |
| Payments | Stripe Checkout, hosted (card · Klarna · Apple/Google Pay — **no Vipps**) |
| Fulfilment | Gelato Order API (printed in Oslo) |
| Images | Sharp — mockups composited on upload |
| Email | Resend — receipts + ops alerts |
| Hosting | Vercel (+ Vercel Cron) |

**Mock mode is the headline dev feature:** Stripe, Gelato and Resend each fall
back to a local simulation when their keys are absent. The entire purchase flow —
add to cart → pay → order paid → Gelato submitted → receipt — runs offline with
**only a Supabase project**. Flip in the real keys to go live.

---

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in Supabase; leave provider keys blank for mock mode
# apply supabase/migrations/0001–0011 (SQL editor or `supabase db push`)
npm run dev                        # http://localhost:3000 → /no
```

Upload a few designs at `/admin/upload` (status *Publisert nå*), then browse
`/no`, add to cart and check out. Full detail — including how to test the
order → paid → fulfilment flow in mock mode — is in **`SETUP.md`**.

Scripts: `npm run dev` · `npm run build` · `npm run start` · `npm run typecheck`.

> `npm run` fails if the checkout path contains an `&` (as in `Fjord&Cotton`): npm's
> Windows shim breaks on it with `MODULE_NOT_FOUND`. Either rename the folder or call
> the binaries directly — `node node_modules/next/dist/bin/next dev`,
> `node node_modules/typescript/bin/tsc --noEmit`.

### Verification scripts

Plain Node, no dependencies, no build step. They read `.env.local` themselves
(`scripts/env.mjs`, same precedence as Next.js) and use the service-role key, so they
hit whichever database `.env.local` points at.

```bash
node scripts/db-sjekk.mjs             # is the schema what the code expects?
node scripts/test-publisering.mjs     # the publishing test list, needs a dev server
node scripts/test-kasse.mjs           # cart → order → paid → fulfilment, needs a dev server
node scripts/rydd-testdata.mjs        # list leftover test designs (--slett to remove)
node scripts/seed-gelato-uids.mjs > uids.sql   # once, after the Gelato template exists
```

`db-sjekk.mjs` reads only: it prints the palette with its Gelato UID patterns, the
size run, the functions the routes call, and the columns each migration adds — so a
migration you forgot shows up there instead of as a 400 on a paid order.

`test-publisering.mjs` drives the real routes: the middleware guard on `/admin`, the
admin API's authentication, the four print files that must be rejected, publishing
with the colour restriction, and that drafts stay out of the storefront. It creates
its designs as `draft` (a published test shirt would be visible in the real shop) and
deletes everything afterwards. Use `APP_URL=http://localhost:3100` for another port.

`test-kasse.mjs` covers what the publishing test cannot reach: cart → order → paid →
Gelato submission → the confirmation page with and without its token, including the
amounts, the free-shipping threshold and webhook idempotency. It adapts to the mode
it finds: with `STRIPE_SECRET_KEY` set it creates a real Checkout session and verifies
it by reading it back **from Stripe** — amount in øre, currency, order reference in
both `client_reference_id` and metadata, `locale: nb`, line items summing to the total
— then stops, because completing the payment needs Stripe's hosted page. Run the dev
server with `STRIPE_MOCK=true` to exercise the whole chain through to fulfilment. Start the dev server
with `EMAIL_MOCK=true` — otherwise the receipt is really sent to the fake address in
the script, and a bounce costs the sending domain reputation. Two bugs found by this
script alone, both invisible until an order was carried all the way to paid:
`create_order` not resolving `gen_random_bytes` (0009), and `gelato_status` being NULL
so `claim_gelato_job` silently refused every paid order (0010).

> Do not run `test-kasse.mjs` against production once the shop is live. It deletes
> its own order row, and *Compliance* below says orders are never deleted; it also
> consumes order numbers, leaving gaps in a sequence Bokføringsloven expects to be
> unbroken. Before launch both are harmless — after launch it belongs in a separate
> Supabase project.

---

## How it works

### Storefront (steps 2–3)
- **i18n** via `/[locale]` routes (`/no` default, `/en`) and a message catalog in
  `lib/i18n.ts` — no `textContent` hacking. `/` redirects to `/no`.
- **Reads** go through the anon client (`lib/supabase/public.ts`); RLS limits them
  to published designs / active variants. Listing is **keyset-paginated**
  (`published_at, id`) — never offset — so "Last inn flere" stays fast at scale.
- Server components render pages (SSR for SEO); small client islands handle the
  cart, filters, buy panel and load-more. The cart lives in `localStorage`
  (`components/cart-provider.tsx`).

### Order lifecycle (steps 4–5)
The money- and state-critical path, all server-side:

```
POST /api/checkout/session
  └─ create_order() (SQL, SECURITY DEFINER)
       • re-prices every line from `variants` (never trusts the client)
       • shipping + VAT rules, sequential order_no (FC-YYYY-######)
       • inserts order + frozen order_lines snapshot, mints access_token
  └─ Stripe Checkout session  (or mock → /[locale]/betaling/[orderNo])
        │  redirect
        ▼
POST /api/webhooks/stripe           ← the ONLY place status becomes 'paid'
  • constructEvent() verifies the signature over the raw body; amount == orders.total
  • mark_order_paid() — idempotent, atomic pending→paid
  • after(): submit Gelato + send receipt   (background, never inline)
        │
        ▼
submitGelatoForOrder()  (lib/fulfillment.ts)
  • claim_gelato_job() — exactly-once, paid-only, reclaims stale claims
  • resolve Gelato UID (colour+size), sign print file (7-day URL), POST order
  • 5 failures → gelato_status='manual_review' + ops-alert email
  ↺ /api/cron/gelato retries stragglers (daily 06:00 backstop, CRON_SECRET)

POST /api/webhooks/gelato   printed → in_production, shipped → shipped (+tracking)
GET  /api/orders/[orderNo]?t=…   token-guarded; confirmation page polls it
```

### Compliance (step 6, `05`)
- **VAT** is gated on `VAT_REGISTERED`. While `false`: no VAT is charged, the
  "herav mva" rows are hidden in cart/checkout/receipt, and the org.nr shows
  without the `MVA` suffix. Flip to `true` on registration and it all reappears.
- Legal pages (`/salgsbetingelser`, `/angrerett` + `/angrerett/skjema`,
  `/personvern`, `/frakt`) in NO+EN, linked from the footer and the consent box.
- Receipts show org.nr, VAT amount, order number and a withdrawal-form link.
- Order numbers are sequential (Bokføringsloven); **orders are never deleted** —
  cancellations/refunds are status changes. Bookkeeping CSV at
  `/api/admin/bookkeeping` for Fiken/Tripletex.

### Go-live (step 7)
- **Norway-only by default** (`CHECKOUT_NORDICS=false`) — enforced in the UI and
  the session route. Open the Nordics only with IOSS/destination VAT.
- `GET /api/admin/launch-check` — live readiness (`{ ready, blockers[], checks }`).
- `robots.txt` + dynamic `sitemap.xml` (every published design, both locales);
  security headers in `next.config.ts`.

---

## Project structure

```
app/
  layout.tsx, globals.css                  # root: fonts, design tokens, metadataBase
  page.tsx                                  # / → /no
  robots.ts, sitemap.ts                     # SEO
  [locale]/
    layout.tsx                              # chrome (announcement, header, footer) + providers
    page.tsx                                # home (hero, live trust count, seasonal)
    katalog/                                # catalog (sidebar filters + keyset load-more)
    design/[slug]/                          # product (SSR, generateMetadata, buy panel)
    handlekurv/ · kasse/ · ordre/[orderNo]/ # cart · checkout · confirmation
    betaling/[orderNo]/                     # mock hosted checkout
    salgsbetingelser · angrerett(/skjema) · personvern · frakt   # legal
  admin/upload/                             # drag-and-drop publishing
  api/
    designs, designs/[slug], collections, facets     # storefront reads
    checkout/session · checkout/mock-complete        # order creation
    webhooks/dintero · webhooks/gelato               # payment + fulfilment
    orders/[orderNo] · cron/gelato                   # confirmation data · retry
    admin/designs · admin/facets · admin/bookkeeping · admin/launch-check
components/                                  # header, footer, cart/checkout, buy panel, tiles, …
lib/
  i18n.ts                                   # NO/EN catalog + routing helpers
  catalog.ts (server) · catalog-format.ts (client-safe)   # reads + shared types/helpers
  cart-totals.ts                            # shipping/VAT rules, payment methods, countries
  stripe.ts · payments.ts · gelato.ts · fulfillment.ts   # providers + the fulfilment job
  email.ts · company.ts                     # receipts/alerts + legal identity
  supabase/public.ts (anon) · supabase/server.ts (service-role)
  env.ts · admin-auth.ts · slug.ts · tokens.ts · money.ts · mockup.ts
supabase/migrations/                        # 0001–0011
scripts/                                    # env.mjs + seed, db-sjekk, test-publisering, test-kasse, rydd-testdata
vercel.json                                 # Gelato retry cron
```

### Migrations

| # | What |
|---|---|
| 0001 | Schema (verbatim from `02-data-model.sql`) |
| 0002 | Reference seed — collections, themes, garment colours & sizes |
| 0003 | Storage buckets + policies |
| 0004 | Fix: `generate_variants` SKU collision (`left(slug,8)` → full slug) — later undone, see 0008 |
| 0005 | `catalog_facets()` — counts + colours/sizes for the storefront |
| 0006 | Orders: sequence, `create_order()`, `mark_order_paid()`, `access_token` |
| 0007 | Fulfilment state, `garment_sizes.gelato_size_code`, `claim_gelato_job()` |
| 0008 | SKU collision again: `02e-design-colors.sql` redefined `generate_variants` from the 0001 version and reintroduced `left(slug,8)`, undoing 0004. Now `FC-<slug8>-<id6>-<COLOUR>-<SIZE>` |
| 0009 | `create_order` could not see `gen_random_bytes`: pgcrypto lives in schema `extensions`, the function is `set search_path = public`. Checkout returned 500 on every order |
| 0010 | `orders.gelato_status` had no default because `02g` added the column before 0007, so 0007's `add column if not exists` was a no-op. NULL never matches `claim_gelato_job`, so every paid order sat unsubmitted, silently |
| 0011 | Dintero → Stripe: `dintero_session_id`/`dintero_transaction_id` renamed to `payment_session_id`/`payment_transaction_id`, and `mark_order_paid` redefined — a plpgsql body resolves column names at runtime, so it breaks the moment a column is renamed |

The 0004 → 02e → 0008 sequence is worth remembering: the `02*.sql` handoff files
each say they replace "the version in `02-data-model.sql`", which is 0001 — so any
of them can silently revert a numbered migration. Check `generate_variants` after
applying one.

---

## Conventions

- **Money** is always integer **øre**, VAT-inclusive gross. No floats. Format via
  `lib/money.ts` (`nb-NO`, ` kr`).
- **Prices are re-priced server-side** at checkout from `variants` — the client
  only ever sends `variantId` + `qty`.
- **Idempotency** everywhere it matters: `mark_order_paid` (pending→paid once),
  `claim_gelato_job` (submit once), forward-only Gelato status updates.
- **`server-only` split**: DB access and secrets live in server-only modules;
  client components import types/pure helpers from `*-format` / client-safe libs.
- **Config flags**: `VAT_REGISTERED`, `CHECKOUT_NORDICS`, and the `*_MOCK` /
  key-absent toggles — all read through `lib/env.ts`.
- **Secrets** never reach the client; admin routes are guarded by `ADMIN_TOKEN`
  (interim — replace with real auth before scaling), cron by `CRON_SECRET`.

Environment variables are documented in **`.env.example`**.

---

## Verified vs. not

Every step was checked with `tsc --noEmit`, `next build`, and runtime smoke tests
of routing, validation and auth boundaries (see each step's notes in `SETUP.md`).
The Sharp mockup pipeline and the pure logic were exercised directly.

**Not exercised in this environment:** the Supabase-backed DB paths and the real
Stripe/Gelato/Resend APIs (no DB or provider accounts here). Mock mode covers the
DB-backed flow end to end once Supabase is configured.

**Caveat:** the exact Gelato request/response shapes and webhook signature
schemes follow the handoff and should be reconfirmed against each provider's
current docs during onboarding (flagged in `lib/dintero.ts`, `lib/gelato.ts` and
the webhook routes).

---

## Documentation map

- **`README.md`** — the original handoff/overview
- **`01`–`05`** — design spec · data model · API & payments · Gelato · compliance
- **`SETUP.md`** — setup, testing, and the go-live checklist
- **`README-DEV.md`** — this file
