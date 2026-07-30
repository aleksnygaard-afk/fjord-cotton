import type { PaymentMethod } from "@/lib/cart-totals";

/**
 * Which provider handles which payment method.
 *
 * Everything goes to Stripe today. The seam exists because Vipps — the most common
 * payment method in Norway — cannot go through Stripe, and will need its own
 * integration against Vipps ePayment API. When that day comes:
 *
 *   1. add "vipps" back to PAYMENT_METHODS in lib/cart-totals.ts
 *   2. add a lib/vipps.ts with create/capture and its own webhook route
 *   3. return "vipps" from providerFor() for that method
 *
 * The order, the amounts and mark_order_paid() stay untouched: a provider only
 * decides where the customer is redirected and which webhook confirms payment.
 */
export type PaymentProvider = "stripe" | "vipps";

export function providerFor(method: PaymentMethod): PaymentProvider {
  switch (method) {
    case "klarna":
    case "card":
    case "wallet":
      return "stripe";
    default: {
      // Exhaustiveness: adding a method to PaymentMethod without routing it here
      // becomes a type error rather than a checkout that silently fails.
      const unhandled: never = method;
      throw new Error(`no payment provider for '${unhandled}'`);
    }
  }
}
