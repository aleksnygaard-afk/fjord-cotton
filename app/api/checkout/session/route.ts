import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { allowedCountryCodes } from "@/lib/cart-totals";
import { createSession, dinteroPaymentType } from "@/lib/dintero";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/session (03-api-and-payments.md, step 2 of the flow).
 * Re-reads/​re-prices the cart server-side, inserts a pending order + line
 * snapshot, creates the Dintero session (or a mock one), and returns the
 * redirect URL. The client never sends prices — only variant ids and quantities.
 */

const Body = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(100),
  email: z.string().email(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(""),
  address1: z.string().trim().min(1).max(160),
  postcode: z.string().trim().min(1).max(16),
  city: z.string().trim().min(1).max(80),
  country: z.enum(["NO", "SE", "DK", "FI"]),
  shippingMethod: z.enum(["pickup", "home", "express"]),
  paymentMethod: z.enum(["vipps", "klarna", "card", "wallet"]),
  consent: z.literal(true),
  locale: z.enum(["no", "en"]).default("no"),
});

const SHIPPING_LABEL: Record<string, string> = {
  pickup: "Hentested — Posten",
  home: "Hjem til døra — Bring",
  express: "Ekspress — Bring 09:00",
};

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Enforce the launch country policy server-side (05-norwegian-compliance.md).
  if (!allowedCountryCodes(env.checkoutNordics).includes(input.country)) {
    return NextResponse.json(
      { error: `shipping to ${input.country} is not available` },
      { status: 422 },
    );
  }

  const db = supabaseAdmin();

  // Merge duplicate variant ids (cart_lines is unique per (cart, variant)).
  const merged = new Map<string, number>();
  for (const it of input.items) {
    merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.qty);
  }

  // Server-side cart row — survives the redirect to Vipps and back (03).
  const cart = await db.from("carts").insert({}).select("id").single();
  if (cart.error || !cart.data) {
    return NextResponse.json(
      { error: `cart: ${cart.error?.message ?? "insert failed"}` },
      { status: 500 },
    );
  }
  const cartId = cart.data.id as string;

  const lineRows = [...merged].map(([variant_id, qty]) => ({
    cart_id: cartId,
    variant_id,
    qty,
  }));
  const linesIns = await db.from("cart_lines").insert(lineRows);
  if (linesIns.error) {
    return NextResponse.json(
      { error: `cart lines: ${linesIns.error.message}` },
      { status: 400 },
    );
  }

  // Create the order (authoritative re-pricing happens inside the function).
  const { data: created, error: orderErr } = await db.rpc("create_order", {
    p_cart: cartId,
    p_email: input.email,
    p_first: input.firstName,
    p_last: input.lastName,
    p_phone: input.phone ?? "",
    p_address1: input.address1,
    p_postcode: input.postcode,
    p_city: input.city,
    p_country: input.country,
    p_shipping_method: input.shippingMethod,
    p_payment_method: input.paymentMethod,
    p_consent: input.consent,
    p_vat_registered: env.vatRegistered,
  });
  if (orderErr) {
    const empty = /empty_cart/.test(orderErr.message);
    return NextResponse.json(
      { error: empty ? "cart is empty or contains unknown items" : orderErr.message },
      { status: empty ? 400 : 500 },
    );
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const order = (created as any).order;
  const lines = (created as any).lines as any[];
  const orderNo: string = order.order_no;
  const token: string = order.access_token;

  const returnUrl = `${env.siteUrl}/${input.locale}/ordre/${orderNo}?t=${token}`;

  // ── Mock mode: simulate the hosted checkout locally ──
  if (env.dinteroMock) {
    const redirectUrl = `${env.siteUrl}/${input.locale}/betaling/${orderNo}?t=${token}`;
    return NextResponse.json({ redirectUrl, orderNo, mock: true });
  }

  // ── Real Dintero session ──
  const vat = env.vatRegistered;
  const vatOf = (gross: number) => (vat ? Math.round(gross * 0.2) : 0);

  const payload: Record<string, unknown> = {
    url: {
      return_url: returnUrl,
      callback_url: `${env.siteUrl}/api/webhooks/dintero`,
    },
    order: {
      amount: order.total,
      currency: "NOK",
      merchant_reference: orderNo,
      vat_amount: order.vat_amount,
      items: lines.map((l, i) => ({
        id: l.sku,
        line_id: String(i + 1),
        description: `${l.title} — ${l.color_name} ${l.size_label}`,
        quantity: l.qty,
        amount: l.line_total,
        vat_amount: vatOf(l.line_total),
        vat: vat ? 25 : 0,
      })),
      shipping_option: {
        id: input.shippingMethod,
        amount: order.shipping,
        vat_amount: vatOf(order.shipping),
        vat: vat ? 25 : 0,
        title: SHIPPING_LABEL[input.shippingMethod],
        operator: input.shippingMethod === "pickup" ? "POSTEN" : "BRING",
      },
      billing_address: {
        first_name: input.firstName,
        last_name: input.lastName,
        address_line: input.address1,
        postal_code: input.postcode,
        postal_place: input.city,
        country: input.country,
        email: input.email,
        phone: input.phone || undefined,
      },
    },
    configuration: {
      vipps: { enabled: true },
      klarna: { enabled: true },
      payex: { card: { enabled: true } },
      default_payment_type: dinteroPaymentType(input.paymentMethod),
    },
  };

  try {
    const session = await createSession(payload);
    await db
      .from("orders")
      .update({ dintero_session_id: session.id })
      .eq("order_no", orderNo);
    return NextResponse.json({ redirectUrl: session.url, orderNo });
  } catch (e) {
    // The order stays 'pending' (never deleted — bookkeeping audit trail).
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "payment session failed" },
      { status: 502 },
    );
  }
}
