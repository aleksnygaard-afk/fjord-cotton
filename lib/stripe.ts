import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/**
 * Stripe Checkout client (03-api-and-payments.md). We use the hosted checkout: the
 * customer is redirected to Stripe, pays there, and comes back to the confirmation
 * page. Which methods are offered — card, Klarna, Apple/Google Pay — is configured
 * in the Stripe dashboard, so adding one is not a code change.
 *
 * Vipps is NOT available through Stripe. It is the most common payment method in
 * Norway, so it will need its own provider against Vipps ePayment API; see
 * lib/payments.ts for where that plugs in.
 *
 * Amounts are integer øre throughout, which is also what Stripe wants for NOK
 * (a two-decimal currency), so no conversion happens anywhere.
 */

let client: Stripe | null = null;

/**
 * The API version is deliberately not pinned here: the SDK pins the version it was
 * built against, and passing a string we invented is how you get silent shape
 * changes. Upgrade by upgrading the package.
 */
export function stripe(): Stripe {
  if (client) return client;
  if (!env.stripe.secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set. See .env.example.");
  }
  client = new Stripe(env.stripe.secretKey);
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(env.stripe.secretKey && env.stripe.webhookSecret);
}

/** True for keys that are still in test mode — used by the launch check. */
export function stripeTestMode(): boolean {
  return env.stripe.secretKey.startsWith("sk_test_");
}

export type CheckoutLine = {
  sku: string;
  title: string;
  colorName: string;
  sizeLabel: string;
  qty: number;
  unitPrice: number; // øre
};

export type CheckoutInput = {
  orderNo: string;
  email: string;
  locale: "no" | "en";
  lines: CheckoutLine[];
  shipping: number; // øre, 0 when free
  shippingLabel: string;
  returnUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { id: string; url: string };

/**
 * Create the hosted session. Two things matter for the webhook later:
 *
 *   client_reference_id  our order number, so the webhook can find the order
 *   metadata.order_no    the same value, because some events carry metadata but
 *                        not client_reference_id
 *
 * Line items are built from the frozen order_lines rather than the cart, so the
 * customer pays exactly what create_order() computed and stored.
 */
export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<CheckoutSession> {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lines.map(
    (l) => ({
      quantity: l.qty,
      price_data: {
        currency: "nok",
        unit_amount: l.unitPrice,
        product_data: {
          name: `${l.title} — ${l.colorName} ${l.sizeLabel}`,
          metadata: { sku: l.sku },
        },
      },
    }),
  );

  // Shipping as a line item rather than a shipping_option: the amount is already
  // decided by our own rules (lib/cart-totals.ts, free above a threshold), and
  // Stripe must not offer the customer a different set.
  if (input.shipping > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "nok",
        unit_amount: input.shipping,
        product_data: { name: input.shippingLabel },
      },
    });
  }

  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: items,
      customer_email: input.email,
      client_reference_id: input.orderNo,
      metadata: { order_no: input.orderNo },
      // Stripe's Norwegian locale is 'nb' (bokmål). Passing 'no' — our own route
      // segment — is rejected outright: "Invalid locale: must be one of …".
      locale: input.locale === "no" ? "nb" : "en",
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      payment_intent_data: {
        // Shows up on the customer's bank statement and in the Stripe dashboard.
        description: `Fjord & Cotton ${input.orderNo}`,
        metadata: { order_no: input.orderNo },
      },
    },
    // Retrying the same order must not create a second session — and therefore
    // cannot charge twice.
    { idempotencyKey: `checkout:${input.orderNo}` },
  );

  if (!session.url) {
    throw new Error(`Stripe session ${session.id} came back without a url`);
  }
  return { id: session.id, url: session.url };
}

/**
 * Verify and parse a webhook body. The signature covers `timestamp.payload` and
 * carries a tolerance window, which is why the RAW body must be passed in — a
 * parsed-and-restringified object will not match.
 *
 * Throws on a bad signature; the caller answers 400 so Stripe retries.
 */
export function constructEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.stripe.webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set — refusing to trust the body");
  }
  return stripe().webhooks.constructEvent(
    rawBody,
    signature,
    env.stripe.webhookSecret,
  );
}
