import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { stripeConfigured, stripeTestMode } from "@/lib/stripe";
import { gelatoConfigured } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/launch-check (admin-token) — live status of the go-live
 * checklist (README §7, 05-norwegian-compliance.md). Turns the manual pre-launch
 * list into something an operator can hit to see what is still mock/unconfigured.
 */
export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  // Gelato product mapping completeness — every colour needs a UID template.
  let unmappedColors: string[] = [];
  let mappingChecked = false;
  try {
    const { data } = await db
      .from("garment_colors")
      .select("key, gelato_variant_key");
    mappingChecked = true;
    unmappedColors = (data ?? [])
      .filter((c) => !(c as { gelato_variant_key: string | null }).gelato_variant_key)
      .map((c) => (c as { key: string }).key);
  } catch {
    /* DB not reachable — report unknown */
  }

  // A published product must exist to have a shop worth launching.
  let publishedCount: number | null = null;
  try {
    const { count } = await db
      .from("designs")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");
    publishedCount = count ?? 0;
  } catch {
    /* ignore */
  }

  const siteUrlHttps = env.siteUrl.startsWith("https://");
  const mappingComplete = mappingChecked && unmappedColors.length === 0;

  const checks = {
    vatRegistered: env.vatRegistered,
    stripe: {
      configured: stripeConfigured(),
      live: !env.stripeMock,
      testMode: stripeTestMode(),
    },
    gelato: {
      configured: gelatoConfigured(),
      live: !env.gelatoMock,
      mappingComplete,
      unmappedColors,
    },
    email: { configured: Boolean(env.email.resendApiKey), live: !env.emailMock },
    cronSecret: Boolean(env.cronSecret),
    siteUrlHttps,
    checkoutNordics: env.checkoutNordics,
    publishedCount,
  };

  // Blockers = things that must be true to take real orders.
  const blockers: string[] = [];
  if (!checks.vatRegistered)
    blockers.push("VAT not registered (VAT_REGISTERED=false) — do not charge VAT.");
  if (env.stripeMock)
    blockers.push("Stripe in mock mode — set STRIPE_SECRET_KEY.");
  if (!env.stripeMock && !env.stripe.webhookSecret)
    blockers.push(
      "STRIPE_WEBHOOK_SECRET missing — the webhook rejects every call, so no order becomes paid.",
    );
  if (!env.stripeMock && stripeTestMode())
    blockers.push("Stripe is on test keys (sk_test_…) — no real money moves.");
  if (env.gelatoMock) blockers.push("Gelato in mock mode — set GELATO_API_KEY.");
  if (!mappingComplete)
    blockers.push(
      mappingChecked
        ? `Gelato UID missing for colours: ${unmappedColors.join(", ") || "?"}.`
        : "Could not verify Gelato product mapping (DB unreachable).",
    );
  if (env.emailMock) blockers.push("Email in mock mode — set RESEND_API_KEY.");
  if (!checks.cronSecret) blockers.push("CRON_SECRET not set (fulfilment retries disabled).");
  if (!siteUrlHttps) blockers.push("NEXT_PUBLIC_SITE_URL is not https.");
  if (checks.checkoutNordics)
    blockers.push("Nordics enabled at checkout — confirm IOSS/destination VAT.");
  if (publishedCount !== null && publishedCount === 0)
    blockers.push("No published designs.");

  return NextResponse.json({ ready: blockers.length === 0, blockers, checks });
}
