/**
 * Cart / checkout money rules (client-safe). All amounts are integer øre, gross
 * (VAT-inclusive). Mirrors 03-api-and-payments.md:
 *   shipping: pickup 0, home 5900, express 14900 øre; 0 if subtotal ≥ 59900.
 *   VAT shown in summaries = round(total * 0.20) — the 25 % component of a gross
 *   figure — and is HIDDEN entirely until VAT registration is approved
 *   (05-norwegian-compliance.md, VAT_REGISTERED flag).
 *
 * These are display totals only. The authoritative re-pricing happens
 * server-side when the Dintero session is created (build-order step 4) — never
 * trust a price sent by the client.
 */

export const FREE_SHIPPING_THRESHOLD = 59900; // øre (599 kr)

export type ShippingMethod = "pickup" | "home" | "express";
export const SHIPPING_METHODS: ShippingMethod[] = ["pickup", "home", "express"];
export const SHIPPING_COST: Record<ShippingMethod, number> = {
  pickup: 0,
  home: 5900,
  express: 14900,
};

export type PaymentMethod = "vipps" | "klarna" | "card" | "wallet";
export const PAYMENT_METHODS: PaymentMethod[] = [
  "vipps",
  "klarna",
  "card",
  "wallet",
];
// 34×20px colour chip per method (01-design-spec.md §6).
export const PAYMENT_CHIP: Record<PaymentMethod, string> = {
  vipps: "#ff5b24",
  klarna: "#ffb3c7",
  card: "#2a3446",
  wallet: "#c9c2b0",
};

// Checkout countries. Launch is Norway-only (05-norwegian-compliance.md); the
// other Nordics open behind CHECKOUT_NORDICS once IOSS/destination VAT is handled.
export function allowedCountryCodes(nordics: boolean): string[] {
  return nordics ? ["NO", "SE", "DK", "FI"] : ["NO"];
}

export type Totals = {
  subtotal: number;
  shipping: number;
  total: number;
  vat: number | null; // null when VAT is not being charged/displayed
};

/** Effective shipping for a method, honouring the free-shipping threshold. */
export function effectiveShipping(
  subtotal: number,
  method: ShippingMethod,
): number {
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_COST[method];
}

export function computeTotals(
  subtotal: number,
  method: ShippingMethod,
  vatRegistered: boolean,
): Totals {
  const shipping = effectiveShipping(subtotal, method);
  const total = subtotal + shipping;
  return {
    subtotal,
    shipping,
    total,
    vat: vatRegistered ? Math.round(total * 0.2) : null,
  };
}
