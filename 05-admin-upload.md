# 05 — Admin: batch upload and publish

The whole business depends on this page. Ten designs a day means metadata handling must
take minutes, not hours. Design reference: the `admin` screen in `Fjord & Cotton.dc.html`
(footer → Admin).

**Mockups come from Gelato, not from us.** We do not photograph garments and we do not
composite images. A product template in the Gelato dashboard defines the six colours,
seven sizes, print placement and mockup scenes once; every design after that is one API
call. This removes the largest build item and the largest daily time cost.

Requires a **Gelato+** plan — Mockup Studio and mockup downloads are not on the free tier.

---

## Route

```
/logg-inn                  magic-link login
/admin                     the batch upload page
POST /api/admin/upload-url  signed upload URL per file
POST /api/admin/designs     create designs + Gelato products from a batch
POST /api/webhooks/gelato    also receives mockup-ready events
```

## Auth — do this before anything else

`/admin` publishes to a live shop. It must not be reachable by URL alone. Design
reference: the login screen behind the Admin link.

1. Supabase Auth → Providers → enable **Email**, magic link only. Disable signups.
2. Add one user manually in the dashboard: `hei@fjordcotton.no`.
3. Guard the path in `middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/logg-inn', req.url))
  return res
}

export const config = { matcher: ['/admin/:path*'] }
```

`/api/admin/*` re-checks the session server-side. Never trust the middleware alone.

---

## One-time setup: the Gelato product template

Do this once, by hand, in the Gelato dashboard. Everything downstream depends on it
being right, so spend the hour.

1. **Templates** → new template → pick the blank: 220 g combed cotton unisex crewneck.
2. Enable exactly six colours — hvit, sort, sand, salvie, marine, rust — and XS–3XL.
   The set must match `garment_colors` and `garment_sizes` in the database.
3. Set the print placement: front, 100 px safe margin, centred, chest width consistent
   across all colours.
4. Choose mockup scenes. **Pick one flatlay scene and use it for all six colours.**
   A catalog where every tile is shot the same way reads as a brand; a mix of scenes
   reads as a marketplace. Skip lifestyle and AI scenes here — save those for social.
5. Save, then copy the **Template ID** from the UI into `GELATO_TEMPLATE_ID`.
6. Call Get Template once and store the returned variant list. It gives you every
   `productUid` and the image placeholder names — this is where
   `garment_colors.gelato_variant_key` comes from, so you never look UIDs up by hand.

Changing the template later does not retroactively change published products. Treat a
template change as a new template and only apply it to new designs.

---

## Storage

Supabase Storage, one private bucket:

| Bucket | Public | Holds |
|---|---|---|
| `print-files` | no | the 4500×5400 PNGs |

No `mockups` bucket. Mockup images are served from Gelato's CDN and we store URLs.

Print files stay private — they are the product. Gelato needs to fetch each file, so
pass a **signed URL valid 24 hours**, never a public link.

---

## Upload flow

Upload from the browser straight to Storage. Do not route 20 MB PNGs through a Vercel
function; you will hit the body limit.

```
1. Client asks POST /api/admin/upload-url → { path, token } per file
2. Client uploads with supabase.storage.from('print-files').uploadToSignedUrl(...)
3. Client POSTs batch metadata to /api/admin/designs
```

### Validate on the client before upload

- PNG only
- ≥ 4200 × 5000 px (read with `createImageBitmap`)
- **has an alpha channel with actual transparent pixels** — a white box behind the art
  prints as a white rectangle on a black shirt. The single most common POD mistake, and
  Gelato will not catch it for you
- under 40 MB

---

## What the form asks vs. what is derived

Three fields per row. Everything else is computed.

| Field | Source |
|---|---|
| `title` | prefilled from filename, prefix and extension stripped |
| `theme_id` | dropdown, defaults to last used |
| `collection_id` | dropdown, bulk-settable for the whole queue |
| `price` | defaults to 349, override rare |
| `contrast` | three buttons: Lys / Mørk / Alle — see below |
| `allowed_colors` | `colors_for_contrast(contrast)` |
| `slug` | slugified title, `æøå` → `ae/o/aa`, collision suffix `-2` |
| `tile_bg` | next colour in the rotating palette — the placeholder shown while mockups are pending |
| `status` | `published` or `scheduled` |
| `publish_at` | now, or tomorrow 08:00 Europe/Oslo |
| variants | `generate_variants(design_id)` — 42 rows, or 21 when restricted |
| `gelato_product_id` | returned by Create Product |
| mockups | Gelato generates them; we receive URLs by webhook |

---

### Contrast: which shirts a design is sold on

A black silhouette is invisible on the black shirt. Three strategies, one click each,
with a swatch row showing which of the six colours the design will be offered in —
dimmed dots are not sold.

| Button | `contrast` | Colours |
|---|---|---|
| Lys | `light_safe` | hvit, sand, salvie |
| Mørk | `dark_safe` | sort, marine, rust |
| Alle | `neutral` | all six |

Default is `neutral`. Getting this wrong is not cosmetic — it ships an unwearable shirt
and produces a return, so it is a required field in practice even though the schema
allows the default.

Migration: `02e-design-colors.sql`. It rewrites `generate_variants()` to honour
`allowed_colors`, so changing the strategy later and re-running it deactivates the
variants that no longer apply — it never deletes them, because receipts must still
resolve.

## POST /api/admin/designs

```ts
// body: { rows: [{ printPath, title, themeKey, collectionKey, price, schedule }] }
// returns: { created: [{ id, slug }], failed: [{ title, reason }] }
```

Per row:

1. insert into `designs` with `mockup_status = 'pending'`
2. `select generate_variants(design_id)`
3. sign a 24 h URL for the print file
4. **Create Product** on Gelato from the template, passing the signed URL into the image
   placeholder. Gelato creates the variants and publishes mockup images in the background
5. store the returned product id on `designs.gelato_product_id`
6. on failure, roll back that row and continue — one bad file must not kill a batch of
   ten. Report per row; the UI marks that row red

Idempotency: unique index on `designs.slug`. A double-submitted batch fails the second
time instead of duplicating the catalog. Also pass a stable external reference to Gelato
so a retry does not create a second product.

---

## Mockups arriving

Gelato publishes mockups asynchronously, so a design exists before its images do.

1. Gelato posts to `/api/webhooks/gelato` when the product's mockups are ready
2. Fetch the product, read one mockup URL per colour
3. Insert into `design_mockups`, marking a primary colour `is_primary`
4. `select repair_primary_mockup(design_id)` — the template returns all six mockups, so
   a `dark_safe` design would otherwise get a white-shirt tile it does not sell
5. Set `designs.mockup_status = 'ready'`

The product page reads `design_colors(design_id)` for swatches and
`design_mockups_visible` for images — both already filtered to the allowed colours.
Never list `garment_colors` directly on a product page.

The catalog reads the `catalog_designs` view, which only returns designs with
`mockup_status = 'ready'`. So a design in flight is simply not in the shop yet — no
broken images, ever. The admin row shows "Mangler mockup" until the webhook lands,
which is exactly the fourth row's state in the design.

**Poll as a fallback.** If the webhook has not arrived within 15 minutes, a cron job
fetches the product directly. Do not leave a design stuck invisible because one webhook
was lost.

**Hotlinking vs. copying.** Storing Gelato URLs is the fast path and fine to launch on.
It does mean your product images live on someone else's CDN and disappear if you leave
Gelato. Once you have revenue, add a job that copies each mockup into your own bucket
and rewrites `design_mockups.url`. The column makes that a data migration, not a
code change.

---

## Build order

1. Auth + the guard. Without it the page is a liability.
2. The Gelato template, by hand, and Get Template stored. Everything depends on it.
3. The table with three fields, no upload — type a row, publish, confirm it appears in
   the shop. That proves the whole write path.
4. Signed upload + validation.
5. Create Product + the mockup webhook.

Between steps 3 and 5 the shop can render `tile_bg` colour tiles, which is what the
wireframe already shows. You are never blocked.

---

## Daily routine once built

```
1. Generate ten designs in Recraft, export SVG → PNG 4500×5400 transparent
2. /admin → drop ten files
3. Bulk-set the collection, adjust the ten titles
4. Publish, or schedule for tomorrow 08:00
5. Wait a few minutes for mockups, then spot-check two product pages
```

Target: ten minutes of your attention. If it takes longer, the bottleneck is in this
page and worth fixing before adding features anywhere else.
