# Handoff: Fjord & Cotton — Norwegian T-shirt Shop

## Overview

A print-on-demand t-shirt store for the Norwegian and Nordic market. The business publishes ~10 new
designs per day and the catalog is expected to grow into the thousands, so the storefront is built
around a large, filterable, seasonally-merchandised archive rather than a small curated catalog.

Legal entity: **Nygård Multiservice**, org.nr **925 714 089** (VAT registration pending — the UI
already displays "inkl. 25 % mva", keep it).

The owner has decided **against Shopify** and wants a self-hosted stack. This package contains the
finished design plus the complete implementation plan for building it.

## About the Design Files

`Fjord & Cotton.dc.html` in this folder is a **design reference created in HTML** — a working
prototype showing the intended look, copy and behaviour. It is **not production code to copy
directly**. The task is to recreate it in the target stack (recommended below) using that stack's
conventions: real routing, real data, real payments.

Open the file in a browser to click through the whole flow. All state is in-memory.

## Fidelity

**High fidelity.** Colors, typography, spacing, copy (Norwegian and English) and interaction states
are final and should be reproduced exactly. Only the imagery is placeholder — striped grey blocks
with monospace captions mark where real design artwork and model photography go.

## Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | The design ports over directly; SSR matters for SEO on thousands of product pages |
| Styling | Tailwind or CSS Modules | Either is fine; tokens are listed in `01-design-spec.md` |
| Database | Postgres via Supabase | Free to start, good for the catalog scale, storage for design artwork included |
| Payments | **Dintero** (alternative: Nets Easy) | One integration and one settlement covering Vipps, Klarna, card and Apple/Google Pay |
| Fulfilment | Gelato API | Prints in Oslo — no customs, 2–3 day delivery inside Norway |
| Images | Supabase Storage or Cloudflare R2 + an image CDN | Thousands of print files need transformation on the fly |
| Hosting | Vercel | Zero-config for Next.js |

Do **not** integrate Vipps ePayment, Klarna and Stripe separately. Dintero bundles all of them
behind one API, one contract and one payout, which is a large reduction in build and compliance
work for a one-person business.

## What is in this package

| File | Contents |
|---|---|
| `Fjord & Cotton.dc.html` | The design prototype — open in a browser |
| `01-design-spec.md` | Screen-by-screen spec, design tokens, components, states |
| `02-data-model.sql` | Postgres schema for designs, variants, orders, collections |
| `03-api-and-payments.md` | API routes and the full Dintero checkout flow |
| `04-gelato-fulfilment.md` | Print-on-demand integration and the daily publishing pipeline |
| `05-norwegian-compliance.md` | VAT, angrerett, GDPR, bookkeeping — what is legally required |

## Build order

1. Schema + admin upload flow (`02`, `04`) — you cannot test a shop with no products
2. Catalog and product pages (`01`) — the bulk of the UI
3. Cart and checkout UI (`01`)
4. Dintero integration in test mode (`03`)
5. Gelato order submission on payment webhook (`04`)
6. Legal pages and receipts (`05`)
7. Go live: Dintero production keys, VAT registration confirmed

Steps 1–3 are safe to build before the company's VAT and Vipps agreements are finalised.

## Assets

No production imagery exists yet. Every image slot in the prototype is a placeholder. The shop
needs, per design: a flat print file (transparent PNG, 4500×5400 px, 300 dpi for Gelato), a
generated mockup on the shirt, and optionally one model photo per collection.
"# fjord-cotton" 
