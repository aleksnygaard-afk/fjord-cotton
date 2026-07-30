import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-auth";
import { slugifyBase, uniqueSlug } from "@/lib/slug";
import { rotatingTileBg } from "@/lib/tokens";
import { kronerToOre } from "@/lib/money";
import { renderMockups } from "@/lib/mockup";
import { env } from "@/lib/env";

export const runtime = "nodejs";
// Print files are large; allow generous execution time for upload + compositing.
export const maxDuration = 60;

/**
 * POST /api/admin/designs  (multipart/form-data)
 *
 * The one-file-at-a-time upload step of the daily publishing pipeline
 * (04-gelato-fulfilment.md). For each print file the admin supplies only:
 * title, theme, collection, optional price override, and a publish choice.
 * Everything else is derived:
 *   - slug            from the title (+ collision counter)
 *   - tile_bg         rotating palette
 *   - mockup/detail   composited from the print with Sharp
 *   - variants        generate_variants() — one row per colour × size
 *   - provenance      prompt + generator stored for IP disputes
 */

const FormSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(120),
  themeKey: z.string().trim().min(1).optional(),
  collectionKey: z.string().trim().min(1).optional(),
  // Whole kroner as typed by the admin; converted to øre. Rare (premium art).
  priceOverrideKr: z.coerce.number().int().positive().max(100000).optional(),
  status: z.enum(["draft", "scheduled", "published"]),
  // Which shirt colours the art is legible on (02f-final-palette.sql).
  contrast: z.enum(["light_safe", "dark_safe", "neutral"]).default("neutral"),
  // ISO datetime; required when status = scheduled.
  publishAt: z.string().datetime().optional(),
  prompt: z.string().trim().max(4000).optional(),
  generator: z.string().trim().max(120).optional(),
});

// Gelato artwork requirements (04-gelato-fulfilment.md).
const REQUIRED_W = 4500;
const REQUIRED_H = 5400;

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 },
    );
  }

  // ── Validate metadata ──
  const parsed = FormSchema.safeParse({
    title: form.get("title"),
    themeKey: form.get("themeKey") || undefined,
    collectionKey: form.get("collectionKey") || undefined,
    priceOverrideKr: form.get("priceOverrideKr") || undefined,
    status: form.get("status"),
    contrast: form.get("contrast") || undefined,
    publishAt: form.get("publishAt") || undefined,
    prompt: form.get("prompt") || undefined,
    generator: form.get("generator") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;

  if (input.status === "scheduled" && !input.publishAt) {
    return NextResponse.json(
      { error: "publishAt is required when status is 'scheduled'" },
      { status: 422 },
    );
  }

  // ── Validate the print file ──
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "a print file is required (field 'file')" },
      { status: 422 },
    );
  }
  const printBuffer = Buffer.from(await file.arrayBuffer());

  const warnings: string[] = [];
  let meta: sharp.Metadata;
  try {
    meta = await sharp(printBuffer).metadata();
  } catch {
    return NextResponse.json(
      { error: "file is not a readable image" },
      { status: 422 },
    );
  }
  if (meta.format !== "png") {
    return NextResponse.json(
      { error: "print file must be a PNG (transparent, 4500×5400)" },
      { status: 422 },
    );
  }
  // A missing alpha channel is a hard reject, not a warning: the white box behind
  // the art prints as a white rectangle, and it surfaces on a shirt already shipped.
  if (!meta.hasAlpha) {
    return NextResponse.json(
      {
        error:
          "print file has no alpha channel — a white box prints as a white rectangle on dark shirts",
      },
      { status: 422 },
    );
  }

  // An alpha channel can still be fully opaque, so check the edges. Corners and
  // edge midpoints must be transparent: art is centred, so an opaque frame means
  // the generator left a background in. The client checks the same thing before
  // uploading, but the server must not trust it.
  try {
    const { data: alpha, info } = await sharp(printBuffer)
      .ensureAlpha()
      .extractChannel(3)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const at = (x: number, y: number) => alpha[y * info.width + x];
    const w = info.width - 1;
    const h = info.height - 1;
    const probes: [number, number][] = [
      [2, 2],
      [w - 2, 2],
      [2, h - 2],
      [w - 2, h - 2],
      [w >> 1, 2],
      [w >> 1, h - 2],
      [2, h >> 1],
      [w - 2, h >> 1],
    ];
    if (probes.filter(([x, y]) => at(x, y) > 8).length >= 5) {
      return NextResponse.json(
        { error: "print file background is not transparent" },
        { status: 422 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "could not read the print file's transparency" },
      { status: 422 },
    );
  }
  if (meta.width !== REQUIRED_W || meta.height !== REQUIRED_H) {
    warnings.push(
      `print file is ${meta.width}×${meta.height}; Gelato requires ${REQUIRED_W}×${REQUIRED_H} @300dpi`,
    );
  }

  const db = supabaseAdmin();

  // ── Resolve theme / collection keys → ids ──
  let themeId: string | null = null;
  if (input.themeKey) {
    const { data, error } = await db
      .from("themes")
      .select("id")
      .eq("key", input.themeKey)
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!data)
      return NextResponse.json(
        { error: `unknown theme '${input.themeKey}'` },
        { status: 422 },
      );
    themeId = data.id;
  }

  let collectionId: string | null = null;
  if (input.collectionKey) {
    const { data, error } = await db
      .from("collections")
      .select("id")
      .eq("key", input.collectionKey)
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!data)
      return NextResponse.json(
        { error: `unknown collection '${input.collectionKey}'` },
        { status: 422 },
      );
    collectionId = data.id;
  }

  // ── Derive slug (unique) and tile_bg (rotating palette) ──
  const slug = await uniqueSlug(slugifyBase(input.title), async (candidate) => {
    const { data } = await db
      .from("designs")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    return Boolean(data);
  });

  const { count: designCount } = await db
    .from("designs")
    .select("id", { count: "exact", head: true });
  const tileBg = rotatingTileBg(designCount ?? 0);

  const basePrice = input.priceOverrideKr
    ? kronerToOre(input.priceOverrideKr)
    : 34900;

  // ── Upload artwork (print → private bucket; mockups → public bucket) ──
  const printPath = `${slug}/print.png`;
  const mockupPath = `${slug}/mockup.webp`;
  const detailPath = `${slug}/detail.webp`;
  const uploaded: { bucket: string; path: string }[] = [];

  try {
    const printUp = await db.storage
      .from(env.printBucket)
      .upload(printPath, printBuffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (printUp.error) throw new Error(`print upload: ${printUp.error.message}`);
    uploaded.push({ bucket: env.printBucket, path: printPath });

    const { mockup, detail } = await renderMockups(printBuffer);

    const mockupUp = await db.storage
      .from(env.mockupBucket)
      .upload(mockupPath, mockup, { contentType: "image/webp", upsert: true });
    if (mockupUp.error)
      throw new Error(`mockup upload: ${mockupUp.error.message}`);
    uploaded.push({ bucket: env.mockupBucket, path: mockupPath });

    const detailUp = await db.storage
      .from(env.mockupBucket)
      .upload(detailPath, detail, { contentType: "image/webp", upsert: true });
    if (detailUp.error)
      throw new Error(`detail upload: ${detailUp.error.message}`);
    uploaded.push({ bucket: env.mockupBucket, path: detailPath });
  } catch (e) {
    await cleanupUploads(db, uploaded);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "artwork upload failed" },
      { status: 502 },
    );
  }

  const mockupUrl = db.storage.from(env.mockupBucket).getPublicUrl(mockupPath)
    .data.publicUrl;
  const detailUrl = db.storage.from(env.mockupBucket).getPublicUrl(detailPath)
    .data.publicUrl;

  // ── Publishing state ──
  // print_file_url stores the bucket-relative path (the bucket is private);
  // fulfilment signs a short-lived URL from it at order time (04).
  const publishedAt =
    input.status === "published"
      ? new Date().toISOString()
      : input.status === "scheduled"
        ? input.publishAt!
        : null;

  // ── Colour restriction ──
  // Must be written on the design BEFORE generate_variants() runs, or the design
  // gets variants in all six colours no matter what was chosen. 'neutral' returns
  // null, which generate_variants() reads as "every colour".
  const colors = await db.rpc("colors_for_contrast", { p: input.contrast });
  if (colors.error) {
    await cleanupUploads(db, uploaded);
    return dbError(`colour lookup failed: ${colors.error.message}`);
  }
  const allowedColors = (colors.data as string[] | null) ?? null;

  // ── Insert the design ──
  const insert = await db
    .from("designs")
    .insert({
      slug,
      title_no: input.title,
      contrast: input.contrast,
      allowed_colors: allowedColors,
      theme_id: themeId,
      collection_id: collectionId,
      base_price: basePrice,
      tile_bg: tileBg,
      print_file_url: printPath,
      mockup_url: mockupUrl,
      detail_url: detailUrl,
      status: input.status,
      published_at: publishedAt,
      prompt: input.prompt ?? null,
      generator: input.generator ?? null,
    })
    .select("id, slug, status, base_price, tile_bg, mockup_url, published_at")
    .single();

  if (insert.error || !insert.data) {
    await cleanupUploads(db, uploaded);
    return dbError(insert.error?.message ?? "insert failed");
  }
  const design = insert.data;

  // ── Generate variants (one row per colour × size) ──
  const gen = await db.rpc("generate_variants", { p_design: design.id });
  if (gen.error) {
    return NextResponse.json(
      {
        error: `design created but variant generation failed: ${gen.error.message}`,
        design,
      },
      { status: 500 },
    );
  }

  const { count: variantCount } = await db
    .from("variants")
    .select("id", { count: "exact", head: true })
    .eq("design_id", design.id);

  // ── Audit trail ──
  const actor = request.headers.get("x-admin-actor") ?? "admin";
  const logRows = [{ design_id: design.id, action: "created", actor }];
  if (input.status === "published")
    logRows.push({ design_id: design.id, action: "published", actor });
  await db.from("publish_log").insert(logRows);

  return NextResponse.json(
    {
      design: {
        id: design.id,
        slug: design.slug,
        status: design.status,
        basePrice: design.base_price,
        tileBg: design.tile_bg,
        mockupUrl: design.mockup_url,
        publishedAt: design.published_at,
        variantCount: variantCount ?? 0,
      },
      warnings,
    },
    { status: 201 },
  );
}

function dbError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

async function cleanupUploads(
  db: ReturnType<typeof supabaseAdmin>,
  uploaded: { bucket: string; path: string }[],
) {
  // Best-effort: don't let cleanup failures mask the original error.
  const byBucket = new Map<string, string[]>();
  for (const u of uploaded) {
    byBucket.set(u.bucket, [...(byBucket.get(u.bucket) ?? []), u.path]);
  }
  for (const [bucket, paths] of byBucket) {
    try {
      await db.storage.from(bucket).remove(paths);
    } catch {
      /* ignore */
    }
  }
}
