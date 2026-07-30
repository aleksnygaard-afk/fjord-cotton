import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal Gelato Order API client (04-gelato-fulfilment.md). Account setup is
 * self-service (no signed agreement), so this can be built and tested in parallel
 * with Stripe. When GELATO_API_KEY is absent we run in mock mode.
 *
 * Note we do NOT use Gelato's ecommerce API (templates / products / mockups):
 * mockups are composited locally in lib/mockup.ts, which is both better looking
 * and free of Gelato's 24-hour signed-URL expiry. Gelato only needs a productUid
 * and a print file, and only at order time.
 */

const ORDER_ENDPOINT = "https://order.gelatoapis.com/v4/orders";

export function gelatoConfigured(): boolean {
  return Boolean(env.gelato.apiKey);
}

/**
 * Resolve the Gelato product UID from the per-colour template and the size code
 * (04: mapping lives in the DB, not code). The template holds a {size}
 * placeholder, e.g. `..._gsi_{size}_gco_black_gpr_4-0`. Returns null when the
 * mapping is missing so the caller can flag the order for manual review.
 */
export function resolveGelatoUid(
  template: string | null | undefined,
  sizeCode: string | null | undefined,
): string | null {
  if (!template) return null;
  if (template.includes("{size}")) {
    if (!sizeCode) return null;
    // Gelato labels 2XL as "2xl"; our size key is "xxl". Without this mapping
    // every 2XL order fails at Gelato with a 404 on the productUid.
    const gelatoSize = sizeCode === "xxl" ? "2xl" : sizeCode;
    return template.split("{size}").join(gelatoSize);
  }
  return template;
}

export type GelatoItem = {
  itemReferenceId: string;
  productUid: string;
  quantity: number;
  // 'default' is the primary print area — on apparel that means the front.
  // "front" is not a documented type and the order is rejected.
  files: { type: "default" | "back"; url: string }[];
};

export type GelatoOrderPayload = {
  orderType: "order";
  orderReferenceId: string; // idempotency key on Gelato's side
  customerReferenceId: string;
  currency: string;
  items: GelatoItem[];
  shipmentMethodUid: "normal" | "express";
  shippingAddress: Record<string, string | undefined>;
};

export type GelatoOrderResult = { id: string };

/**
 * Distinguishes "the request is wrong" from "try again later". 400/401/404 mean
 * retrying sends the same broken body — flag for manual review instead.
 */
export class GelatoError extends Error {
  status: number;
  retryable: boolean;
  constructor(status: number, body: string) {
    super(`Gelato order failed: ${status} ${body.slice(0, 400)}`);
    this.name = "GelatoError";
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

export async function submitOrder(
  payload: GelatoOrderPayload,
  attempt = 0,
): Promise<GelatoOrderResult> {
  const res = await fetch(ORDER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": env.gelato.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (res.ok) {
    const json = (await res.json()) as { id: string };
    return { id: json.id };
  }

  const error = new GelatoError(res.status, await res.text());

  // Gelato recommends exponential backoff on 429. Jittered so retries from
  // several orders do not line up.
  if (error.retryable && attempt < 5) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000 + Math.random() * 400));
    return submitOrder(payload, attempt + 1);
  }
  throw error;
}
