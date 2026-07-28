import { NextResponse } from "next/server";
import { getDesignBySlug } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/designs/[slug] — design + variants + related from the same collection. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const design = await getDesignBySlug(slug);
    if (!design) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ design });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to load design" },
      { status: 500 },
    );
  }
}
