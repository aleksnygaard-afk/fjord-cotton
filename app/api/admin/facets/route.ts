import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAuthorizedAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * GET /api/admin/facets
 * Themes and collections for the upload form's selects. Admin-guarded so the
 * shared token is exercised before any upload is attempted.
 */
export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const [themes, collections] = await Promise.all([
    db.from("themes").select("key, name_no, name_en").order("name_no"),
    db
      .from("collections")
      .select("key, name_no, name_en, sort_order")
      .order("sort_order"),
  ]);

  if (themes.error || collections.error) {
    return NextResponse.json(
      { error: themes.error?.message ?? collections.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    themes: themes.data,
    collections: collections.data,
  });
}
