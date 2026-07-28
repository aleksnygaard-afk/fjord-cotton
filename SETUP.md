# Fjord & Cotton — developer setup (build-order step 1)

This is the running implementation of the store in `README.md`, using the
recommended stack: **Next.js (App Router) + TypeScript**, **Supabase** (Postgres
+ Storage), **Sharp** for mockups. Payments (Dintero) and fulfilment (Gelato)
are later build-order steps and are not wired up yet.

**What step 1 delivers:** the database schema + reference data, and the admin
upload flow — "you cannot test a shop with no products".

---

## 1. Prerequisites

- Node.js 20+ (verified on 24) and npm.
- A Supabase project. **Choose an EU region at creation** — it cannot be changed
  later and Norwegian data should stay in the EU/EEA (`05-norwegian-compliance.md`).
  Local Supabase via the CLI (`supabase start`, needs Docker) works too.

## 2. Install

```bash
npm install
```

## 3. Environment

Copy the example and fill it in:

```bash
cp .env.example .env.local
```

From **Supabase → Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (**server only, never shipped to the browser**)

Then set `ADMIN_TOKEN` to any secret string — the admin UI sends it as the
`x-admin-token` header. Leave `VAT_REGISTERED=false` (registration is pending;
charging VAT while unregistered is an offence — `05-norwegian-compliance.md`).

## 4. Apply the database

Migrations live in `supabase/migrations/`, in order:

| File | What |
|---|---|
| `0001_schema.sql` | The schema, verbatim from `02-data-model.sql` |
| `0002_seed_reference.sql` | Collections, themes, garment colours & sizes (idempotent) |
| `0003_storage.sql` | Storage buckets `print-files` (private) and `mockups` (public) + read policy |
| `0004_fix_generate_variants.sql` | Fixes a SKU-collision bug in the handoff's `generate_variants` (see note below) |
| `0005_catalog_functions.sql` | `catalog_facets()` — published count + collection/theme counts + colours/sizes for the storefront (step 2) |
| `0006_orders.sql` | Order number sequence + `create_order()` (server-side re-pricing) + `mark_order_paid()` (idempotent paid transition), `orders.access_token` (step 4) |
| `0007_fulfillment.sql` | Gelato fulfilment state on orders + `garment_sizes.gelato_size_code` + `claim_gelato_job()` atomic once-only claim (step 5) |

**Option A — Supabase SQL editor (cloud):** open each file and run them in order.

**Option B — Supabase CLI:**

```bash
supabase link --project-ref <your-ref>   # or: supabase start  (local)
supabase db push                          # applies everything in supabase/migrations
```

> **Note on `0004`.** The handoff's `generate_variants` builds SKUs from
> `left(slug, 8)`. Designs whose slugs share the first 8 characters
> (`design-001` / `design-002`, `sommernatt-001` / `sommernatt-002`) collide on
> the UNIQUE `variants.sku`, so generating the second one throws and the upload
> fails. `0004` rebuilds the SKU from the full (already unique) slug. Kept as a
> separate migration so `0001` stays faithful to the handoff.

## 5. Run

```bash
npm run dev
```

Storefront (build-order step 2), server-rendered with `/no` and `/en` routes
(Norwegian bokmål default; the header NO/EN toggle swaps locale in place):

- `/` → redirects to `/no`
- `/no` — home: hero, trust bar (**live** published count), Nytt i dag, value
  props, "I sesong nå" (seasonal collections, empty ones hidden)
- `/no/katalog` — catalog: sticky sidebar filters (collection/theme with counts,
  colour swatches, size chips), 4-up grid, "Last inn flere". Filters compose via
  URL params, e.g. `/no/katalog?collection=jul&theme=natur&q=nordlys`, `?new=1`
- `/no/design/[slug]` — product: image grid + sticky buy panel (colour/size,
  live price, add-to-cart, Vipps). SSR with per-design `<title>`/description
- `/no/handlekurv` — cart: line items + qty steppers, live summary, empty state
- `/no/kasse` — checkout: contact + delivery + payment + consent, sticky order
  summary. Free shipping at subtotal ≥ 599 kr; VAT rows hidden while
  `VAT_REGISTERED=false` (05-norwegian-compliance.md)
- `/no/ordre/[orderNo]` — order confirmation
- `/admin/upload` — the admin upload flow (step 1)

## Payments — Dintero (step 4): test mode vs mock mode

Checkout is wired end to end. The "Betal" button POSTs `/api/checkout/session`,
which **re-prices the cart server-side from `variants`** (the client only sends
variant ids + quantities — never prices), inserts a `pending` order with a
**sequential** `order_no` (`FC-YYYY-######`) and a frozen line snapshot, then
creates the payment session and returns a redirect URL.

Payment becomes `paid` in exactly one place: `POST /api/webhooks/dintero`. It is
idempotent (safe on retries) and rejects any authorised amount that doesn't equal
`orders.total`. The browser return URL is only a UI convenience.

Two ways to run it:

- **Mock mode (default when Dintero credentials are absent).** The session
  redirects to an internal simulated checkout at `/[locale]/betaling/[orderNo]`.
  "Betal" calls `/api/checkout/mock-complete`, which drives the **same**
  `mark_order_paid` path the real webhook uses, then returns to the confirmation
  page — which polls `/api/orders/[orderNo]` (token-guarded) and shows "behandler
  betaling" until it flips to paid. This lets you test the whole order flow with
  only Supabase — no Dintero onboarding needed.
- **Real test mode.** Put your Dintero **test** credentials (`DINTERO_*`) in
  `.env.local`. The session then creates a real Dintero checkout and redirects
  there; Vipps/Klarna/card test flows call the webhook. Set `DINTERO_WEBHOOK_SECRET`
  to enable HMAC verification, and the webhook re-fetches the transaction from
  Dintero rather than trusting the callback body.

> The exact Dintero request/response shapes and the callback signature scheme
> should be reconfirmed against the current Dintero docs during onboarding
> (`lib/dintero.ts`, `app/api/webhooks/dintero/route.ts` note this). Gelato
> submission (step 5) and the receipt email (step 6) are `TODO` hooks fired right
> after the first successful `paid` transition.

### Test checklist (from 03), once Supabase is configured

- A purchase completes and the webhook flips the order to `paid` (mock: click
  "Betal"; real: Vipps test app)
- Amount tampering is rejected — the server re-prices, so a forged low amount at
  the webhook fails the `mark_order_paid` amount check
- Webhook replay is idempotent (no double transition; step 5 will guard Gelato)
- Subtotal exactly 599,00 kr → free shipping; 598,00 kr → not
- A Swedish address still uses the same rules — and while `VAT_REGISTERED=false`
  no VAT is charged or shown at all (05-norwegian-compliance.md)

## Fulfilment — Gelato (step 5)

On the first `paid` transition the webhook enqueues Gelato submission as a
**background job** (`after()` — never inline) via `submitGelatoForOrder()`. It:

1. **claims** the order atomically (`claim_gelato_job`) so it submits exactly
   once, even with concurrent webhook + cron runs, and never for an unpaid order;
2. resolves each line's **Gelato product UID** from the DB (colour+size), signs
   the frozen print file (private bucket → 7-day signed URL), and POSTs the order
   to Gelato (`orderReferenceId = order_no` is Gelato's idempotency key);
3. stores `gelato_order_id`; on repeated failure (5 attempts) flags the order
   `gelato_status = 'manual_review'` (step 6 will email the alert).

A **retry cron** (`/api/cron/gelato`, guarded by `CRON_SECRET`) re-attempts paid
orders that haven't submitted — covering dropped `after()` work, transient Gelato
errors, and crashed claims (reclaimed after 10 min). It's scheduled every 15 min
in `vercel.json`; on Supabase you can use `pg_cron`, or a scheduled agent.
Gelato's status webhook (`/api/webhooks/gelato`) maps **printed → in_production**,
**shipped → shipped** (forward-only, idempotent) and saves the tracking URL.

**Product mapping (do this before real orders).** The Gelato UID encodes colour
and size. Store a per-colour **template** with a `{size}` placeholder in
`garment_colors.gelato_variant_key`, and the Gelato size code in
`garment_sizes.gelato_size_code` (defaulted to our size keys by `0007`):

```sql
update garment_colors set gelato_variant_key =
  'apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_{size}_gco_black_gpr_4-0'
  where key = 'sort';   -- repeat per colour with the real UID for your blank
```

**Mock vs real.** With `GELATO_API_KEY` absent the job runs in **mock mode**: it
doesn't call Gelato and records a `mock-gelato-…` id (and a stub UID if the
mapping isn't filled in yet), so the full **paid → submitted** flow is testable
with only Supabase. Set the key to submit for real. Verify:

```sql
select order_no, status, gelato_status, gelato_order_id, gelato_attempts,
       gelato_last_error, tracking_url
from orders order by created_at desc limit 5;
```

## Legal, receipts & bookkeeping (step 6)

**Legal pages** (`/[locale]/…`, NO + EN, linked from the footer and the checkout
consent) cover the `05` checklist — align them with the Forbrukertilsynet
standard template before go-live:

- `/salgsbetingelser` — company, org.nr, prices/VAT, delivery, payment, angrerett,
  reklamasjon, dispute resolution (Forbrukertilsynet / Forbrukerrådet / EU ODR)
- `/angrerett` — the 14-day rules, how to return, who pays return postage; and
  `/angrerett/skjema` — the standardised **Angrerettskjema** (print → save as PDF)
- `/personvern` — data, purpose, legal basis, processors (Dintero, Gelato, email,
  Supabase, Vercel — EU/EEA), 5-year retention, rights, cookies note
- `/frakt` — carriers, prices, times, free-shipping threshold

The org.nr renders **without** the MVA suffix while `VAT_REGISTERED=false` and
**with** it (`925 714 089 MVA`) once you flip the flag — same for the VAT clause
in the terms.

**Receipt email.** On the first `paid` transition the webhook (and mock-complete)
sends a receipt via Resend containing the **org.nr, VAT amount, order number, line
snapshot, totals** and a link to the **withdrawal form** + terms. Gelato
manual-review failures email an **ops alert**. With `RESEND_API_KEY` blank both run
in **mock mode** (logged, not sent), so the flow works offline; set the key +
`EMAIL_FROM` (verified domain) to send for real. Receipts are Norwegian (bokmål).

**Bookkeeping export.** `GET /api/admin/bookkeeping?from=YYYY-MM-DD&to=YYYY-MM-DD`
(admin-token) returns a CSV of paid orders — `order_no, paid_date, status,
currency, net, vat, gross` — for import into **Fiken/Tripletex**. Pull it nightly
(cron or manual). Orders are never deleted; records are kept 5 years.

**Cookies/consent banner:** only essential (cart/session) cookies are used, so no
banner is required. Add one only if you introduce analytics/marketing cookies.

### Seeing the storefront with data

The storefront reads only **published** designs. After configuring Supabase and
applying the migrations, upload a few designs via `/admin/upload` with
**status = Publisert nå** (or schedule + publish), then open `/no`. An empty
catalog shows the empty-state card; the trust bar count reflects the real number.

## 6. Test the admin upload flow

**Via the UI:** open `/admin/upload`, connect with the token, set defaults
(theme / collection / status), drag in one or more PNGs, adjust titles, and
**Last opp**. Each file:

1. uploads the print to the private `print-files` bucket,
2. generates a 4:5 mockup and 1:1 detail with Sharp → public `mockups` bucket,
3. inserts the `designs` row (slug derived from the title, `tile_bg` from the
   rotating palette, `prompt`/`generator` provenance stored),
4. runs `generate_variants()` — 6 colours × 6 sizes = **36 variants** per design,
5. writes a `publish_log` audit row.

Real Gelato-spec art is a transparent PNG at **4500×5400**. Other sizes still
upload but the response includes a warning.

**Via curl** (a quick synthetic print file works for smoke-testing):

```bash
curl -X POST http://localhost:3000/api/admin/designs \
  -H "x-admin-token: <your ADMIN_TOKEN>" \
  -F "title=Nordlys" \
  -F "themeKey=natur" \
  -F "collectionKey=vinter" \
  -F "status=published" \
  -F "generator=gpt-image-1" \
  -F "file=@/path/to/print.png;type=image/png"
```

A `201` returns the created design, its `variantCount` (36), and any warnings.
Verify in Supabase:

```sql
select slug, status, tile_bg from designs order by created_at desc limit 5;
select count(*) from variants;                 -- 36 per design
select * from v_published_count;               -- powers the home trust bar (step 2)
select * from v_collection_counts;             -- powers the sidebar / "I sesong nå"
```

## 7. What has been verified

- `npm run build` and `tsc --noEmit` pass clean (steps 1 + 2).
- The Sharp mockup pipeline produces correct-dimension WebP output and never
  overflows the canvas for odd-aspect sources.
- The admin auth boundary returns `401` without/with a wrong token and proceeds
  with the right one.
- Storefront routing: `/` → `/no`, invalid locales 404, all storefront pages are
  dynamic (`ƒ`) so counts are live per request (not baked at build). API routes
  return clean JSON errors.
- Cart, checkout and confirmation render at runtime (200) with no DB — the
  confirmation shows the thank-you + order number in both `/no` and `/en`.
- Checkout session validation returns 422 (missing fields / consent not true);
  the webhook returns 400 on a payload with no `merchant_reference`; the mock
  checkout and confirmation pages render (200).
- Fulfilment boundaries: the Gelato webhook returns 400 with no
  `orderReferenceId`; the retry cron fails closed (401 without/with a wrong
  `CRON_SECRET`, proceeds to the DB with the right one).
- Legal pages render (200) in `/no` and `/en` with the required content; the
  org.nr shows without the MVA suffix while `VAT_REGISTERED=false`; the
  bookkeeping export is admin-guarded (401 without the token).

**Not yet exercised here:** the Supabase-backed paths — uploads, catalog/product
rendering, and the order state machine (`create_order` → session →
`mark_order_paid` → confirmation). Configure Supabase + apply the migrations,
then in **mock mode** you can walk the full purchase offline: upload a published
design, add to cart, checkout, click "Betal" on the simulated page, and watch the
confirmation flip to paid. The **real** Dintero API is untested here (onboarding
needs org.nr + BankID).

## Project layout

```
app/
  layout.tsx, page.tsx, globals.css        # root: fonts + tokens; / → /no
  [locale]/layout.tsx                      # chrome: announcement, header, footer + providers
  [locale]/page.tsx                        # home
  [locale]/katalog/page.tsx                # catalog (sidebar + results)
  [locale]/design/[slug]/page.tsx          # product (SSR, generateMetadata)
  [locale]/handlekurv/page.tsx             # cart
  [locale]/kasse/page.tsx                  # checkout
  [locale]/betaling/[orderNo]/page.tsx     # mock Dintero checkout (test mode)
  [locale]/ordre/[orderNo]/page.tsx        # order confirmation (polls status)
  [locale]/salgsbetingelser | angrerett(/skjema) | personvern | frakt  # legal pages
  admin/upload/page.tsx                    # drag-and-drop upload UI
  api/designs, api/designs/[slug],         # storefront read API (cursor-paginated)
  api/collections, api/facets
  api/checkout/session                     # create order + Dintero/mock session
  api/checkout/mock-complete               # mock-mode payment completion
  api/webhooks/dintero                     # THE place an order becomes paid → enqueues Gelato
  api/webhooks/gelato                      # production/shipping status → in_production/shipped
  api/orders/[orderNo]                     # token-guarded confirmation data
  api/cron/gelato                          # fulfilment retry (CRON_SECRET)
  api/admin/designs, api/admin/facets      # admin API (step 1)
  api/admin/bookkeeping                    # CSV export for Fiken/Tripletex (step 6)
components/
  header.tsx, footer.tsx                   # global chrome
  i18n-provider.tsx, cart-provider.tsx     # locale + cart (localStorage) contexts
  product-tile.tsx                         # shared tile (isomorphic)
  catalog-sidebar.tsx, catalog-results.tsx # filters + "Last inn flere"
  buy-panel.tsx                            # product colour/size + add-to-cart
  cart-view.tsx, checkout-view.tsx         # cart + checkout UI
  mock-checkout.tsx, order-status.tsx      # mock payment + confirmation poller
lib/
  i18n.ts                                  # NO/EN message catalog + routing helpers
  catalog.ts                               # server reads (anon client, keyset paging)
  catalog-format.ts                        # client-safe types + pure helpers
  cart-totals.ts                           # shipping/VAT rules, payment methods
  dintero.ts                               # Dintero client (token/session/txn) + mock
  gelato.ts                                # Gelato client + UID resolver + mock
  fulfillment.ts                           # submitGelatoForOrder — the background job
  email.ts                                 # Resend + receipt HTML + ops alert (+ mock)
  company.ts                               # legal identity (org.nr, MVA suffix)
  supabase/public.ts, supabase/server.ts   # anon + service-role clients
  admin-auth.ts, env.ts, slug.ts, tokens.ts, money.ts, mockup.ts
supabase/migrations/                       # 0001–0007
vercel.json                                # Gelato retry cron schedule
```

## Notes / remaining refinements

- **Mobile.** Layouts reflow (hero stacks, grids collapse, sidebar unsticks). The
  richer mobile patterns from the spec — filters in a bottom sheet, a sticky
  bottom buy bar — are a follow-up refinement.
- Colour/size in the sidebar are visual selectors (as in the prototype); the
  composing filters are collection AND theme AND search.

## Go live (step 7 — README pre-launch checklist)

- [ ] VAT registration approved → set `VAT_REGISTERED=true` (org.nr shows the MVA
      suffix; VAT rows + amounts reappear across cart/checkout/receipt)
- [ ] Dintero agreement signed → production `DINTERO_*` keys + `DINTERO_WEBHOOK_SECRET`
- [ ] Gelato product UIDs filled into `garment_colors.gelato_variant_key`, real
      `GELATO_API_KEY` + `GELATO_WEBHOOK_SECRET`
- [ ] `RESEND_API_KEY` + verified `EMAIL_FROM`; test a real receipt
- [ ] Supabase + Vercel projects in an **EU region**; `CRON_SECRET` set
- [ ] Legal pages reviewed against the Forbrukertilsynet template
- [ ] Non-Norwegian countries removed from checkout, or IOSS registered
- [ ] Bookkeeping export tested against Fiken/Tripletex
- [ ] One real end-to-end order: Vipps → paid → Gelato → tracking → receipt
