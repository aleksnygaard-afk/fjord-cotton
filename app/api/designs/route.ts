import { NextResponse } from "next/server";
import { listDesigns, DEFAULT_LIMIT } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/designs?collection=&theme=&q=&cursor=&limit=
 * Cursor-based (published_at, id). Powers "Last inn flere" and later the cart.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));

  try {
    const result = await listDesigns({
      collection: searchParams.get("collection") ?? undefined,
      theme: searchParams.get("theme") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      onlyNew: searchParams.get("new") === "1",
      cursor: searchParams.get("cursor"),
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to list designs" },
      { status: 500 },
    );
  }
}
