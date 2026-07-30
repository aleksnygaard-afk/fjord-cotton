import { NextResponse, after } from "next/server";
import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/server";
import { constructEvent } from "@/lib/stripe";
import { submitGelatoForOrder } from "@/lib/fulfillment";
import { sendReceipt } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe — the ONLY place an order becomes 'paid' (03).
 * Server-to-server and authoritative; the browser return URL is a UI convenience
 * that can be lost, replayed or forged.
 *
 * Idempotent: mark_order_paid() keys the transition on pending→paid, so Stripe's
 * retries are safe. The paid amount must equal orders.total.
 *
 * Unlike the old Dintero handler, this one does not re-fetch the session to confirm
 * the amount. It does not need to: constructEvent() verifies an HMAC over
 * `timestamp.rawBody` with the endpoint secret, so the body is Stripe's own words.
 * That verification is the whole reason the raw body is read as text here — parsing
 * and re-stringifying would change bytes and break the signature.
 *
 * Configure the endpoint in the Stripe dashboard to send:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded
 *   checkout.session.async_payment_failed
 */

const HANDLED = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructEvent(raw, signature);
  } catch (e) {
    // 400 tells Stripe the delivery failed; it will retry. A wrong secret looks
    // exactly like this, so check STRIPE_WEBHOOK_SECRET before suspecting Stripe.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad signature" },
      { status: 400 },
    );
  }

  if (!HANDLED.has(event.type)) {
    // Acknowledge everything else. An unhandled event is not a failure, and a
    // non-2xx would put this endpoint into Stripe's retry queue for no reason.
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderNo = session.client_reference_id ?? session.metadata?.order_no;
  if (!orderNo) {
    // Nothing to act on, and retrying will not add the reference. Acknowledge so it
    // leaves the queue, but say so in the body for the dashboard's event log.
    return NextResponse.json({ ok: true, ignored: "no order reference" });
  }

  // Klarna and other delayed methods complete the session before the money is
  // confirmed: payment_status stays 'unpaid' until async_payment_succeeded arrives.
  // Marking paid here would submit a print order for a payment that can still fail.
  if (event.type === "checkout.session.async_payment_failed") {
    return NextResponse.json({ ok: true, status: "payment_failed", orderNo });
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return NextResponse.json({
      ok: true,
      status: "awaiting_payment",
      paymentStatus: session.payment_status,
      orderNo,
    });
  }

  const transactionId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? session.id);

  const db = supabaseAdmin();
  const { data, error } = await db.rpc("mark_order_paid", {
    p_order_no: orderNo,
    p_transaction_id: transactionId,
    p_amount: session.amount_total, // øre, same unit as orders.total
    p_payment_method: paymentMethodOf(session),
  });
  if (error) {
    // 500 so Stripe retries — a database blip must not lose a paid order.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { status: string };
  if (result.status === "amount_mismatch") {
    // Do not retry: the amounts genuinely disagree and a human has to look.
    return NextResponse.json({ error: "amount mismatch", orderNo }, { status: 409 });
  }
  if (result.status === "not_found") {
    return NextResponse.json({ error: "unknown order", orderNo }, { status: 404 });
  }

  if (result.status === "paid") {
    // First successful transition. Submit to Gelato and send the receipt as
    // background jobs (after the response, never inline). Both run once — this
    // block only executes on the pending→paid transition.
    after(() => submitGelatoForOrder(orderNo));
    after(() => sendReceipt(orderNo));
  }

  return NextResponse.json({ ok: true, status: result.status, orderNo });
}

/**
 * Our own four-value vocabulary, not Stripe's. Left empty when we cannot tell:
 * mark_order_paid() then keeps whatever the customer chose at checkout rather than
 * overwriting it with a guess.
 */
function paymentMethodOf(session: Stripe.Checkout.Session): string {
  const types = session.payment_method_types ?? [];
  if (types.includes("klarna")) return "klarna";
  if (types.includes("card")) return "card";
  return "";
}
