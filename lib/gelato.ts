import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal Gelato Order API client (04-gelato-fulfilment.md). Account setup is
 * self-service (no signed agreement), so this can be built and tested in parallel
 * with Dintero. When GELATO_API_KEY is absent we run in mock mode.
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
    return template.split("{size}").join(sizeCode);
  }
  return template;
}

export type GelatoItem = {
  itemReferenceId: string;
  productUid: string;
  quantity: number;
  files: { type: string; url: string }[];
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

export async function submitOrder(
  payload: GelatoOrderPayload,
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
  if (!res.ok) {
    throw new Error(`Gelato order failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string };
  return { id: json.id };
}
