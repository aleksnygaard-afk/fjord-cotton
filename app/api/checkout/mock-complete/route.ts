import { NextResponse, after } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { submitGelatoForOrder } from "@/lib/fulfillment";
import { sendReceipt } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/mock-complete — mock-mode only. Simulates the Stripe
 * webhook's successful authorisation by driving the SAME mark_order_paid path,
 * so the order → paid state machine is exercised identically to production.
 * Disabled entirely when a real STRIPE_SECRET_KEY is configured.
 */
const Body = z.object({
  orderNo: z.string().min(1),
  t: z.string().min(1),
});

export async function POST(request: Request) {
  if (!env.stripeMock) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 422 });
  }
  const { orderNo, t } = parsed.data;
  const db = supabaseAdmin();

  const { data: order } = await db
    .from("orders")
    .select("order_no, total, payment_method, access_token")
    .eq("order_no", orderNo)
    .maybeSingle();

  if (!order || order.access_token !== t) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { data, error } = await db.rpc("mark_order_paid", {
    p_order_no: orderNo,
    p_transaction_id: `mock-${orderNo}`,
    p_amount: order.total,
    p_payment_method: order.payment_method,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Same downstream hooks the real webhook fires: enqueue Gelato in the
  // background on the first paid transition (steps 5/6).
  const result = data as { status: string };
  if (result.status === "paid") {
    after(() => submitGelatoForOrder(orderNo));
    after(() => sendReceipt(orderNo));
  }
  return NextResponse.json({ ok: true, result });
}
