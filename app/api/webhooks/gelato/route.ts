import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/gelato — production & shipping status updates
 * (04-gelato-fulfilment.md). Maps printed → in_production, shipped → shipped,
 * and saves the tracking URL for the confirmation page + receipt.
 *
 * Forward-only and idempotent: each transition's UPDATE is guarded on the
 * allowed previous statuses, so replays and out-of-order events never regress.
 *
 * NOTE: verification and payload shape should be reconfirmed against Gelato's
 * docs at onboarding. When GELATO_WEBHOOK_SECRET is set we require it via the
 * `secret` query param or an `x-gelato-secret` header.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
function pick(obj: any, ...paths: (string | number)[][]): any {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in cur) cur = cur[key as any];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

function authorized(request: Request, url: URL): boolean {
  const secret = env.gelato.webhookSecret;
  if (!secret) return true; // not configured (dev/mock) — skip
  const provided =
    request.headers.get("x-gelato-secret") ?? url.searchParams.get("secret");
  return provided === secret;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!authorized(request, url)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderNo: string | undefined = pick(
    body,
    ["orderReferenceId"],
    ["order", "orderReferenceId"],
  );
  if (!orderNo) {
    return NextResponse.json({ error: "missing orderReferenceId" }, { status: 400 });
  }

  const rawStatus: string = String(
    pick(body, ["fulfillmentStatus"], ["status"], ["order", "fulfillmentStatus"]) ??
      "",
  ).toLowerCase();

  const trackingUrl: string | undefined = pick(
    body,
    ["trackingUrl"],
    ["shipment", "trackingUrl"],
    ["items", 0, "fulfillments", 0, "trackingUrl"],
    ["trackingCodes", 0, "trackingUrl"],
  );

  const db = supabaseAdmin();
  const trackingPatch = trackingUrl ? { tracking_url: trackingUrl } : {};

  if (rawStatus === "printed" || rawStatus === "in_production") {
    await db
      .from("orders")
      .update({ status: "in_production", ...trackingPatch })
      .eq("order_no", orderNo)
      .eq("status", "paid");
    return NextResponse.json({ ok: true, mapped: "in_production" });
  }

  if (rawStatus === "shipped" || rawStatus === "delivered") {
    await db
      .from("orders")
      .update({ status: "shipped", ...trackingPatch })
      .eq("order_no", orderNo)
      .in("status", ["paid", "in_production"]);
    return NextResponse.json({ ok: true, mapped: "shipped" });
  }

  // Unmapped statuses (created, passed, canceled, …): acknowledge, save tracking
  // if present, but don't change the order status.
  if (trackingUrl) {
    await db.from("orders").update(trackingPatch).eq("order_no", orderNo);
  }
  return NextResponse.json({ ok: true, ignored: rawStatus || "unknown" });
}
