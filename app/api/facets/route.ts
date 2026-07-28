import { NextResponse } from "next/server";
import { getFacets } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/facets — theme and collection counts for the sidebar + published count. */
export async function GET() {
  try {
    return NextResponse.json(await getFacets());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load facets" },
      { status: 500 },
    );
  }
}
