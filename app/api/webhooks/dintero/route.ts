import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { dinteroConfigured, getTransaction } from "@/lib/dintero";
import { submitGelatoForOrder } from "@/lib/fulfillment";
import { sendReceipt } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/dintero — the ONLY place an order becomes 'paid' (03).
 * Server-to-server and authoritative; the browser return URL is a UI
 * convenience that can be lost, replayed or forged.
 *
 * Idempotent: mark_order_paid() keys the transition on pending→paid, so webhook
 * retries are safe. The authorised amount must equal orders.total.
 *
 * NOTE: the signature scheme and payload shape must be reconfirmed against the
 * Dintero docs during onboarding. Here we verify an HMAC-SHA256 of the raw body
 * against DINTERO_WEBHOOK_SECRET when set, and (in real mode) re-fetch the
 * transaction from Dintero rather than trusting the body's amount.
 */

const ACCEPTED_STATUSES = new Set([
  "AUTHORIZED",
  "CAPTURED",
  "PARTIALLY_CAPTURED",
  "ON_HOLD",
]);

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = env.dintero.webhookSecret;
  if (!secret) return true; // no secret configured (mock/dev) — skip
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function pick(obj: any, ...paths: string[][]): any {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in cur) cur = cur[key];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

export async function POST(request: Request) {
  const raw = await request.text();

  const signature =
    request.headers.get("dintero-signature") ??
    request.headers.get("x-dintero-signature");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderNo: string | undefined = pick(
    body,
    ["merchant_reference"],
    ["order", "merchant_reference"],
    ["transaction", "merchant_reference"],
    ["session", "merchant_reference"],
  );
  let transactionId: string | undefined = pick(
    body,
    ["transaction_id"],
    ["id"],
    ["transaction", "id"],
  );
  let amount: number | undefined = pick(
    body,
    ["amount"],
    ["transaction", "amount"],
    ["order", "amount"],
  );
  let status: string | undefined = pick(body, ["status"], ["transaction", "status"]);
  const paymentMethod: string | undefined = pick(
    body,
    ["payment_product_type"],
    ["transaction", "payment_product", "type"],
  );

  if (!orderNo) {
    return NextResponse.json({ error: "missing merchant_reference" }, { status: 400 });
  }

  // Real mode: don't trust the body — re-fetch the transaction from Dintero.
  if (!env.dinteroMock && dinteroConfigured() && transactionId) {
    try {
      const tx = await getTransaction(transactionId);
      amount = tx.amount;
      status = tx.status;
    } catch {
      // If verification fails, ask Dintero to retry rather than mark paid.
      return NextResponse.json({ error: "verification failed" }, { status: 502 });
    }
  }

  // Only a successful authorisation/capture advances the order.
  if (status && !ACCEPTED_STATUSES.has(status)) {
    return NextResponse.json({ ok: true, ignored: status });
  }

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("mark_order_paid", {
    p_order_no: orderNo,
    p_transaction_id: transactionId ?? null,
    p_amount: amount ?? null,
    p_payment_method: paymentMethod ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { status: string };
  if (result.status === "amount_mismatch") {
    return NextResponse.json({ error: "amount mismatch" }, { status: 409 });
  }
  if (result.status === "not_found") {
    return NextResponse.json({ error: "unknown order" }, { status: 404 });
  }

  if (result.status === "paid") {
    // First successful transition. Submit to Gelato and send the receipt as
    // background jobs (after the response, never inline). Both run once — this
    // block only executes on the pending→paid transition.
    after(() => submitGelatoForOrder(orderNo));
    after(() => sendReceipt(orderNo));
  }

  return NextResponse.json({ ok: true, status: result.status });
}
