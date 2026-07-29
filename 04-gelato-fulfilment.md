# Gelato fulfilment and the daily publishing pipeline

## Why Gelato

Norwegian-founded, with a print partner in Oslo. Orders for Norwegian customers are produced and
shipped domestically: no customs declaration, no import VAT, 2–3 day delivery. Printful is the
usual alternative but ships from Latvia, which adds days and a customs step that will generate
support email.

Account setup is self-service and does not require a signed agreement, so this can be built and
tested in parallel with the Dintero onboarding.

## Product mapping

Pick one blank and stay with it — every extra blank multiplies your mockup and QA work.

**Chosen blank: Gildan 5000 Heavy Cotton, unisex crewneck, six colours, S–4XL.**

| Colour | Gelato name | Hex |
|---|---|---|
| `hvit` | White | #f4f2ec |
| `sand` | Sand | #d9cdb4 |
| `oliven` | Military Green | #4b5140 |
| `garnet` | Garnet | #6e2632 |
| `marine` | Navy | #232f43 |
| `sort` | Black | #1a1a18 |

Every one is 100 % cotton. **Excluded on purpose:** Sport Grey (90/10), all heathers, Russet,
Blackberry, Midnight, Lilac, Sunset, Tweed, safety and neon colours — all blends, and the shop
claims 100 % cotton.

Sizes are **S–4XL**, not XS–3XL. Gildan 5000 has no XS, and 5XL is skipped because Military
Green does not offer it — a size missing in one colour produces orders that fail silently.
Migration: `02f-final-palette.sql`.

| Spec | Value | Where it appears in the shop |
|---|---|---|
| Weight | 5.3 oz/yd² = **180 g/m²** | "100 % bomull, 180 g" |
| Fabric | 100 % preshrunk cotton, carded open-end | "forkrympet 100 % bomull" |
| Fit | Classic, tubular body | "klassisk unisex passform" |
| Print | DTF transfer (per the productUid) | "slitesterkt transfertrykk" |

The shop copy was originally written for a 220 g combed-cotton blank and has been corrected to
match this one. **If you change blank, change these three places:** the home hero line, the spec
strip under it, and the product page material paragraph. Overstating fabric weight or calling
carded cotton "combed" is a marketing claim Forbrukertilsynet can act on.

Two things this blank is not: it is not combed (carded open-end, a slightly rougher print surface
than ring-spun), and DTF is a film transfer rather than a water-based ink laid into the fibre — very
durable, marginally less soft to the touch. Do not describe it as DTG.

Gildan 2000 Ultra Cotton is 6 oz ring-spun for a small surcharge and would let you say "ringspunnet"
— worth considering if the fabric ever becomes a customer complaint.

Store the Gelato product UID per colour in `garment_colors.gelato_variant_key`. A UID looks like:

```
apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0
```

Resolve it at order time from colour + size. Keep the mapping in the database, not in code — you
will change blanks eventually and you do not want a deploy for that.

**Do not type these UIDs by hand.** Build the product template first (see `05-admin-upload.md`),
then run `scripts/seed-gelato-uids.mjs`. It calls Get Template, matches Gelato's English colour
names to our keys, and prints the SQL. Hand-copying 42 UIDs is how you end up with one colour
that silently fails at order time.

```bash
GELATO_API_KEY=... GELATO_TEMPLATE_ID=... node seed-gelato-uids.mjs > uids.sql
```

**One UID per colour, not per variant.** The size is a token inside the UID
(`..._gsi_m_gco_black_...`), so the script stores the pattern with `{size}` in place of it —
six rows to maintain instead of 42. Substitute at order time:

```ts
function resolveGelatoUid(colorKey: string, sizeKey: string) {
  const pattern = colorRow.gelato_variant_key   // '..._gsi_{size}_gco_black_...'
  if (!pattern) throw new Error(`No Gelato UID for colour ${colorKey}`)
  return pattern.replace('{size}', sizeKey)
}
```

Throw on a missing pattern. Never fall back to a default colour — printing black when the
customer bought navy is worse than failing the order and telling them.

The script refuses to emit SQL unless all six colours and all seven sizes are present in the
template, and the SQL itself ends in a check that fails the transaction if any colour lacks a
pattern. Both exist because this is the one mapping error you cannot see from the storefront.

## Artwork requirements

| Property | Value |
|---|---|
| Format | PNG with transparency |
| Size | 4500 × 5400 px |
| Resolution | 300 dpi |
| Colour space | sRGB |
| Safe area | Keep content 100 px inside all edges |

The print file is stored on `designs.print_file_url` and **copied onto `order_lines.print_file_url`
at purchase time**. If you later fix or replace a design, reprints and returns must still use the
file the customer actually bought.

## Submitting an order

Triggered from the Dintero webhook, after the order is marked `paid`. Run it as a background job
with retries — never inline in the webhook response.

```ts
// POST https://order.gelatoapis.com/v4/orders
{
  orderType: "order",
  orderReferenceId: order.order_no,          // idempotency key on Gelato's side
  customerReferenceId: order.email,
  currency: "NOK",
  items: lines.map(l => ({
    itemReferenceId: l.sku,
    productUid: resolveGelatoUid(l.color_name, l.size_label),
    quantity: l.qty,
    files: [{ type: "front", url: l.print_file_url }]
  })),
  shipmentMethodUid: order.shipping_method === "express" ? "express" : "normal",
  shippingAddress: {
    firstName: order.first_name, lastName: order.last_name,
    addressLine1: order.address1, city: order.city,
    postCode: order.postcode, country: order.country,
    email: order.email, phone: order.phone
  }
}
```

Store the returned id on `orders.gelato_order_id`. Gelato posts status updates to
`/api/webhooks/gelato` — map `printed` → `in_production`, `shipped` → `shipped`, and save the
tracking URL so the confirmation page and the receipt email can show it.

**Rules:**
- Idempotent on `orderReferenceId`. A webhook replay must not print two shirts.
- If submission fails after 5 retries, flag the order for manual review and alert by email. A paid
  order that never reaches production is the one failure mode that costs you a customer.
- Never submit an order that is not `paid`.

## Economics

At 349 kr retail (gross, VAT-inclusive):

```
Retail                     349,00 kr
− VAT (25 % of gross)      −69,80 kr
= Net revenue              279,20 kr
− Gelato print + blank    ~−110 kr
− Domestic shipping        ~−49 kr   (0 kr to you if the customer paid it)
− Dintero fee (~2 %)        ~−7 kr
= Contribution            ~110–160 kr per shirt
```

Free shipping above 599 kr costs you roughly 49 kr on a two-shirt order — it is priced so that the
threshold pushes basket size rather than eating margin. Do not lower it below 599 kr.

3XL costs Gelato more; `garment_sizes.price_delta` exists for that. 30 kr is typical.

## The daily publishing pipeline

The goal is ten new designs per day reaching a catalog of thousands. The bottleneck is not
generation, it is the repetitive metadata and file handling. Build the admin flow to make one day
take ten minutes.

```
1. Generate artwork externally (10 images per session, prompts written per season).
2. Drop the files into an admin upload page — multi-file drag and drop.
3. For each file the admin form asks only: title, theme, collection, price override (rare).
   Everything else is derived: slug from title, tile_bg from a rotating palette,
   variants created by generate_variants(), and a Gelato product created from the template
   — which is what produces the mockup images.
4. Save as 'scheduled' with a publish date, or publish immediately.
5. A daily cron flips 'scheduled' rows whose published_at has passed to 'published'.
```

Automate hard:
- **Mockups.** Never hand-make these, and do not build your own compositing pipeline either.
  One Gelato product template defines placement and scene; Create Product then returns six
  colour mockups per design. Requires Gelato+. Full flow in `05-admin-upload.md`.
  Trade-off worth knowing: those scenes are available to every Gelato merchant, so your
  catalog is not visually distinctive. Acceptable at launch, worth replacing with your own
  flatlays once there is revenue — `design_mockups.url` makes that a swap, not a rebuild.
- **Slug collisions.** Append a counter; slugs are permanent once published (SEO).
- **Provenance.** Always write `prompt` and `generator` onto the design row. If a marketplace or a
  rights holder ever challenges a design, you need to show what produced it.

### Seasonal scheduling

Collections are seasons and holidays, and seasonal art must be published **before** the season, not
during it. Suggested lead times, since customers buy for an upcoming occasion:

| Collection | Start publishing | Feature on home |
|---|---|---|
| Sommer | April | Jun–Aug |
| Høst | August | Sep–Oct |
| Halloween | mid-September | Oct |
| Jul | October | Nov–Dec |
| Nyttår | late November | Dec |
| Vinterferie | December | Jan–Feb |
| Påske | February | Mar–Apr |
| 17. mai | March | Apr–May |

The home page picks the three soonest upcoming collections that have products, so filling a
collection ahead of time is what makes it appear. An empty collection is hidden automatically.

## IP warning

Generated artwork is not automatically safe to sell. Before publishing, check each design for:
recognisable brand marks or logos, copyrighted characters, celebrity likenesses, and — for the
Norwegian market specifically — municipal coats of arms and the Norwegian coat of arms, which are
protected. A design that gets you a takedown after a hundred sales is more expensive than the
minute it takes to look.
