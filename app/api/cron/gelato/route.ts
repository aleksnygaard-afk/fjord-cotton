import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { submitGelatoForOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fulfilment retry cron (04: "background job with retries"). Re-attempts paid
 * orders that Gelato submission hasn't completed — covers webhook `after()` work
 * that was dropped, transient Gelato errors, and crashed 'submitting' claims
 * (claim_gelato_job reclaims those after 10 min).
 *
 * Schedule it every ~10 min (Vercel Cron in vercel.json, Supabase pg_cron, or a
 * scheduled agent). Guarded by CRON_SECRET (Bearer header or ?secret=). Fails
 * closed if CRON_SECRET is unset.
 */
function authorized(request: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false; // fail closed — configure CRON_SECRET
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("orders")
    .select("order_no")
    .eq("status", "paid")
    .is("gelato_order_id", null)
    .neq("gelato_status", "manual_review")
    .lt("gelato_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { orderNo: string; ok: boolean; reason?: string }[] = [];
  for (const row of data ?? []) {
    const r = await submitGelatoForOrder((row as { order_no: string }).order_no);
    results.push(
      r.ok
        ? { orderNo: (row as any).order_no, ok: true }
        : { orderNo: (row as any).order_no, ok: false, reason: r.reason },
    );
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}
