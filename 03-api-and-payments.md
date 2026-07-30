> **Superseded in part: payments run on Stripe Checkout, not Dintero.**
> The flow in this document is unchanged — server-side re-pricing, a pending order
> with a sequential number, one webhook as the only path to `paid`, idempotent
> `mark_order_paid`, amount verified against `orders.total`. Only the provider and
> the shape of its requests differ. Read this for the flow; read `lib/stripe.ts`
> and `app/api/webhooks/stripe/route.ts` for what is actually called. Note that
> Stripe has no Vipps.

# API routes and the Dintero payment flow

## Why Dintero

Dintero Checkout is a Norwegian payment gateway that exposes Vipps, Klarna, card (Visa/Mastercard)
and Apple/Google Pay through a single hosted or embedded checkout. One integration, one merchant
agreement, one settlement, one PCI scope. Integrating Vipps ePayment, Klarna and Stripe separately
would triple the build and the compliance surface for no gain at this volume.

**Nets Easy** is the equivalent alternative and works the same way; swap the endpoints if the
pricing suits you better.

Onboarding requires: org.nr (925 714 089), BankID signing by the owner, a company bank account,
and a live website with terms of sale and privacy policy published. Start in test mode — you get
test credentials immediately and can build the whole flow before the agreement is approved.

## Route map

```
GET  /api/designs            ?collection=&theme=&q=&color=&size=&cursor=&limit=24
GET  /api/designs/[slug]     design + its variants + related from same collection
GET  /api/collections        from v_collection_counts, includes design_count
GET  /api/facets             theme and collection counts for the sidebar

POST /api/cart               create cart, returns id (also set as httpOnly cookie)
GET  /api/cart               current cart with resolved line prices
POST /api/cart/lines         { variantId, qty }  — upsert
PATCH/DELETE /api/cart/lines/[id]

POST /api/checkout/session   create the order + Dintero session, returns redirect url
POST /api/webhooks/dintero   payment callback — the only place an order becomes 'paid'
GET  /api/orders/[orderNo]   confirmation page data (token-guarded)

POST /api/webhooks/gelato    production and shipping status updates

POST /api/admin/designs      publish a design (service-role auth)
```

Pagination must be **cursor-based** (`published_at, id`), not offset — offset pagination degrades
badly once the catalog is in the thousands and the "Last inn flere" button is doing repeated deep
reads.

## Checkout flow

```
1. Client POSTs /api/checkout/session with the cart id, address, shipping method,
   preferred payment method and the consent flag.

2. Server:
   a. Re-reads the cart from the database and RE-PRICES every line from `variants`.
      Never trust a price sent by the client.
   b. Computes shipping: pickup 0, home 5900, express 14900 øre; 0 if subtotal >= 59900.
   c. Computes vat_amount = round(total * 0.20).
   d. Inserts an `orders` row with status 'pending' and a generated order_no.
   e. Creates a Dintero session and stores dintero_session_id on the order.
   f. Returns the session URL.

3. Client redirects to the Dintero checkout (or embeds it). Vipps takes over on mobile
   and returns the customer to return_url.

4. Dintero calls POST /api/webhooks/dintero.
   - Verify the signature.
   - Verify the authorised amount equals orders.total. Reject on mismatch.
   - Set status = 'paid', paid_at, dintero_transaction_id, payment_method.
   - Enqueue the Gelato order (see 04).
   - Send the receipt email.
   This webhook is the ONLY place an order becomes paid. The browser return URL is a
   UI convenience and can be lost, replayed or forged.

5. The return URL renders the confirmation screen from /api/orders/[orderNo]. If the
   webhook has not landed yet, show "behandler betaling" and poll.
```

### Session payload

```ts
// POST https://checkout.dintero.com/v1/sessions-profile
{
  url: {
    return_url: `${SITE}/no/ordre/${orderNo}`,
    callback_url: `${SITE}/api/webhooks/dintero`   // server-to-server, authoritative
  },
  order: {
    amount: order.total,          // gross øre, matches the DB row exactly
    currency: "NOK",
    merchant_reference: order.order_no,
    vat_amount: order.vat_amount,
    items: lines.map((l, i) => ({
      id: l.sku,
      line_id: String(i + 1),
      description: `${l.title} — ${l.color_name} ${l.size_label}`,
      quantity: l.qty,
      amount: l.line_total,       // gross
      vat_amount: Math.round(l.line_total * 0.20),
      vat: 25
    })),
    shipping_option: {
      id: order.shipping_method,
      amount: order.shipping,
      vat_amount: Math.round(order.shipping * 0.20),
      vat: 25,
      title: SHIPPING_LABEL[order.shipping_method],
      operator: order.shipping_method === "pickup" ? "POSTEN" : "BRING"
    },
    billing_address: { first_name, last_name, address_line, postal_code,
                       postal_place, country: "NO", email, phone }
  },
  configuration: {
    // Order here controls the order shown in the Dintero UI.
    vipps:  { enabled: true },
    klarna: { enabled: true },
    payex:  { card: { enabled: true } },
    // Apple/Google Pay ride along with the card option.
    default_payment_type: preferredMethod
  },
  profile_id: DINTERO_PROFILE_ID
}
```

### Idempotency and money rules

- Webhooks retry. Make the handler idempotent — key on `dintero_transaction_id` and exit early if
  the order is already `paid`.
- Only ever compute totals server-side. The `amount` you send to Dintero must equal the `total`
  written to the database in the same transaction.
- Never delete an order row. Cancellations and refunds are status changes; the Norwegian
  Bookkeeping Act requires the audit trail.
- Amounts are integers in øre throughout. No floats, ever.

## Environment

```
NEXT_PUBLIC_SITE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=       # server only, never in client code
DINTERO_ACCOUNT_ID=
DINTERO_CLIENT_ID=
DINTERO_CLIENT_SECRET=
DINTERO_PROFILE_ID=
DINTERO_WEBHOOK_SECRET=
GELATO_API_KEY=
RESEND_API_KEY=                  # or Postmark, for receipts
```

## Test checklist before going live

- Vipps test app completes a purchase and the webhook flips the order to `paid`
- Amount tampering (client sends a lower price) is rejected
- Webhook replay does not create two Gelato orders
- Subtotal exactly 599,00 kr gives free shipping; 598,00 kr does not
- Order to a Swedish address still charges Norwegian VAT (see `05`)
- Receipt email contains org.nr, VAT amount and the withdrawal form link
