import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import {
  submitOrder,
  resolveGelatoUid,
  type GelatoItem,
} from "@/lib/gelato";
import { sendOpsAlert } from "@/lib/email";

/**
 * Submit a paid order to Gelato (04-gelato-fulfilment.md). Designed to run as a
 * background job (via `after()` from the webhook, or the retry cron) — never
 * inline in the webhook response.
 *
 * Guarantees:
 *  - idempotent: claim_gelato_job() lets exactly one runner submit; a set
 *    gelato_order_id short-circuits, and orderReferenceId dedupes on Gelato's side;
 *  - never submits an order that is not paid (enforced by the claim);
 *  - after 5 failed attempts the order is flagged 'manual_review' (step 6 will
 *    email the alert; a paid order that never reaches production loses a customer).
 */

const SEVEN_DAYS = 60 * 60 * 24 * 7;

async function signPrintUrl(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) return path; // already a URL
  const { data, error } = await supabaseAdmin()
    .storage.from(env.printBucket)
    .createSignedUrl(path, SEVEN_DAYS);
  if (error || !data) {
    throw new Error(`sign print url failed for ${path}: ${error?.message}`);
  }
  return data.signedUrl;
}

export type FulfillResult =
  | { ok: true; gelatoOrderId: string }
  | { ok: false; reason: string };

export async function submitGelatoForOrder(
  orderNo: string,
): Promise<FulfillResult> {
  const db = supabaseAdmin();

  // Claim: atomic, paid-only, once. Returns false if already done / owned / capped.
  const { data: claimed, error: claimErr } = await db.rpc("claim_gelato_job", {
    p_order_no: orderNo,
  });
  if (claimErr) return { ok: false, reason: `claim: ${claimErr.message}` };
  if (!claimed) return { ok: false, reason: "not_claimed" };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: order, error: orderErr } = await db
    .from("orders")
    .select(
      "id, order_no, email, first_name, last_name, phone, address1, postcode, city, country, shipping_method, gelato_attempts",
    )
    .eq("order_no", orderNo)
    .single();
  if (orderErr || !order) {
    await fail(db, orderNo, 0, `load order: ${orderErr?.message}`);
    return { ok: false, reason: "order_not_found" };
  }
  const o: any = order;

  const { data: lineRows, error: linesErr } = await db
    .from("order_lines")
    .select(
      "sku, qty, print_file_url, size_label, color_name, " +
        "variant:variants(color:garment_colors(gelato_variant_key), size:garment_sizes(gelato_size_code, key))",
    )
    .eq("order_id", o.id);
  if (linesErr || !lineRows || lineRows.length === 0) {
    await fail(db, orderNo, o.gelato_attempts, `load lines: ${linesErr?.message}`);
    return { ok: false, reason: "no_lines" };
  }

  // Resolve UIDs + sign print files.
  const items: GelatoItem[] = [];
  const missing: string[] = [];
  try {
    for (const l of lineRows as any[]) {
      const template = l.variant?.color?.gelato_variant_key ?? null;
      const sizeCode =
        l.variant?.size?.gelato_size_code ?? l.variant?.size?.key ?? null;
      let uid = resolveGelatoUid(template, sizeCode);
      if (!uid) {
        if (env.gelatoMock) {
          uid = `mock_uid_${l.sku}`; // let the mock flow complete
        } else {
          missing.push(l.sku);
          continue;
        }
      }
      items.push({
        itemReferenceId: l.sku,
        productUid: uid,
        quantity: l.qty,
        files: [{ type: "front", url: await signPrintUrl(l.print_file_url) }],
      });
    }
  } catch (e) {
    await fail(db, orderNo, o.gelato_attempts, e instanceof Error ? e.message : "sign failed");
    return { ok: false, reason: "sign_failed" };
  }

  if (missing.length > 0) {
    await manualReview(
      db,
      orderNo,
      `missing Gelato product mapping for: ${missing.join(", ")}. Set garment_colors.gelato_variant_key.`,
    );
    return { ok: false, reason: "missing_mapping" };
  }

  const payload = {
    orderType: "order" as const,
    orderReferenceId: o.order_no, // idempotency key on Gelato's side
    customerReferenceId: o.email,
    currency: "NOK",
    items,
    shipmentMethodUid: (o.shipping_method === "express" ? "express" : "normal") as
      | "normal"
      | "express",
    shippingAddress: {
      firstName: o.first_name,
      lastName: o.last_name,
      addressLine1: o.address1,
      city: o.city,
      postCode: o.postcode,
      country: o.country,
      email: o.email,
      phone: o.phone || undefined,
    },
  };

  try {
    const result = env.gelatoMock
      ? { id: `mock-gelato-${o.order_no}` }
      : await submitOrder(payload);

    await db
      .from("orders")
      .update({
        gelato_order_id: result.id,
        gelato_status: "submitted",
        gelato_submitted_at: new Date().toISOString(),
        gelato_last_error: null,
      })
      .eq("order_no", orderNo);

    return { ok: true, gelatoOrderId: result.id };
  } catch (e) {
    await fail(db, orderNo, o.gelato_attempts, e instanceof Error ? e.message : "submit failed");
    return { ok: false, reason: "submit_failed" };
  }
}

async function fail(
  db: ReturnType<typeof supabaseAdmin>,
  orderNo: string,
  attempts: number,
  message: string,
) {
  const next = attempts + 1;
  // After 5 attempts, stop retrying and require a human.
  const status = next >= 5 ? "manual_review" : "failed";
  await db
    .from("orders")
    .update({
      gelato_status: status,
      gelato_attempts: next,
      gelato_last_error: message.slice(0, 500),
    })
    .eq("order_no", orderNo);
  if (status === "manual_review") {
    // A paid order stuck out of production — alert ops (step 6).
    console.error(`[gelato] ${orderNo} → manual_review after ${next}: ${message}`);
    await sendOpsAlert(
      `Gelato manual review: ${orderNo}`,
      `Order ${orderNo} failed Gelato submission ${next} times and needs manual review.\n\nLast error: ${message}`,
    );
  }
}

async function manualReview(
  db: ReturnType<typeof supabaseAdmin>,
  orderNo: string,
  message: string,
) {
  await db
    .from("orders")
    .update({ gelato_status: "manual_review", gelato_last_error: message.slice(0, 500) })
    .eq("order_no", orderNo);
  console.error(`[gelato] ${orderNo} → manual_review: ${message}`);
  await sendOpsAlert(`Gelato manual review: ${orderNo}`, message);
}
