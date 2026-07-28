import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[orderNo]?t=<access_token> — confirmation page data (03,
 * token-guarded). Returns minimal, non-PII fields; the token prevents order
 * enumeration. A wrong/missing token is a 404 (does not reveal existence).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { orderNo } = await params;
  const token = new URL(request.url).searchParams.get("t") ?? "";

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("orders")
    .select(
      "order_no, status, total, vat_amount, currency, paid_at, access_token",
    )
    .eq("order_no", orderNo)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || !token || data.access_token !== token) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    orderNo: data.order_no,
    status: data.status,
    total: data.total,
    vatAmount: data.vat_amount > 0 ? data.vat_amount : null,
    currency: data.currency,
    paidAt: data.paid_at,
  });
}
