import { NextResponse } from "next/server";
import { getFacets } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/collections — collections with published design_count (03-api-and-payments.md). */
export async function GET() {
  try {
    const { collections } = await getFacets();
    return NextResponse.json({ collections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load collections" },
      { status: 500 },
    );
  }
}
