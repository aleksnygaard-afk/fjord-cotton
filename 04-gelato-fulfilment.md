# Gelato fulfilment and the daily publishing pipeline

## Why Gelato

Norwegian-founded, with a print partner in Oslo. Orders for Norwegian customers are produced and
shipped domestically: no customs declaration, no import VAT, 2–3 day delivery. Printful is the
usual alternative but ships from Latvia, which adds days and a customs step that will generate
support email.

Account setup is self-service and does not require a signed agreement, so this can be built and
tested in parallel with the Dintero onboarding.

## Product mapping

Pick one blank and stay with it — every extra blank multiplies your mockup and QA work. The design
assumes a 220 g combed cotton unisex tee in six colours, XS–3XL.

Store the Gelato product UID per colour in `garment_colors.gelato_variant_key`. A UID looks like:

```
apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_black_gpr_4-0
```

Resolve it at order time from colour + size. Keep the mapping in the database, not in code — you
will change blanks eventually and you do not want a deploy for that.

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
   mockups rendered from the print file, variants created by generate_variants().
4. Save as 'scheduled' with a publish date, or publish immediately.
5. A daily cron flips 'scheduled' rows whose published_at has passed to 'published'.
```

Automate hard:
- **Mockups.** Do not hand-make 6 colour mockups per design. Composite the print file onto a
  garment template with a Sharp/Canvas job, or use Gelato's preview API. Six renders per design,
  generated on upload.
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
