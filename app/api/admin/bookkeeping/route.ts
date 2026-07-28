import { supabaseAdmin } from "@/lib/supabase/server";
import { isAuthorizedAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bookkeeping?from=YYYY-MM-DD&to=YYYY-MM-DD
 * CSV of paid orders for import into Fiken / Tripletex (05-norwegian-compliance.md).
 * Columns: order number, paid date, net, VAT, gross — all øre → kroner, 2dp.
 * Admin-token guarded. Pull nightly (cron or manual). Records are kept 5 years;
 * orders are never deleted — cancellations/refunds are status changes.
 */
export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const db = supabaseAdmin();
  let q = db
    .from("orders")
    .select("order_no, paid_at, created_at, status, currency, total, vat_amount")
    // Orders that have been paid (and beyond) count for bookkeeping.
    .in("status", ["paid", "in_production", "shipped", "refunded"])
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: true });

  if (from) q = q.gte("paid_at", `${from}T00:00:00Z`);
  if (to) q = q.lte("paid_at", `${to}T23:59:59Z`);

  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kr = (ore: number) => (ore / 100).toFixed(2);
  const header = "order_no,paid_date,status,currency,net,vat,gross";
  const rows = (data ?? []).map((o) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const r = o as any;
    const gross = r.total as number;
    const vat = r.vat_amount as number;
    const net = gross - vat;
    const date = new Date(r.paid_at).toISOString().slice(0, 10);
    return [
      r.order_no,
      date,
      r.status,
      r.currency,
      kr(net),
      kr(vat),
      kr(gross),
    ].join(",");
  });
  const csv = [header, ...rows].join("\n") + "\n";

  const filename = `fjord-cotton-bokforing${from ? `-${from}` : ""}${to ? `-${to}` : ""}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
