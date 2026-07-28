import "server-only";
import { supabasePublic } from "@/lib/supabase/public";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Named,
  type DesignCard,
  type ListParams,
  type ListResult,
  type Facets,
  type ProductColor,
  type ProductSize,
  type ProductVariant,
  type ProductDetail,
} from "@/lib/catalog-format";

/**
 * Storefront read model. All reads go through the anon client, so RLS restricts
 * them to published designs / active variants (02-data-model.sql).
 *
 * Pagination is keyset (published_at, id) — never offset — so "Last inn flere"
 * stays fast once the catalog is in the thousands (03-api-and-payments.md).
 *
 * Shared types + client-safe helpers live in lib/catalog-format.ts; re-exported
 * here for existing server-side importers.
 */
export {
  DEFAULT_LIMIT,
  LOAD_MORE_STEP,
  pickTitle,
  pickName,
  featuredCollections,
} from "@/lib/catalog-format";
export type {
  Named,
  DesignCard,
  ListParams,
  ListResult,
  Facets,
  CollectionFacet,
  ThemeFacet,
  ColorFacet,
  SizeFacet,
  ProductColor,
  ProductSize,
  ProductVariant,
  ProductDetail,
} from "@/lib/catalog-format";

// ── Cursor ───────────────────────────────────────────────────
function encodeCursor(publishedAt: string, id: string): string {
  return Buffer.from(`${publishedAt}|${id}`).toString("base64url");
}
function parseCursor(
  cursor: string | null | undefined,
): { ts: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [ts, id] = Buffer.from(cursor, "base64url").toString().split("|");
    if (!ts || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

// ── Row mapping ──────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function toNamed(row: any): Named | null {
  if (!row) return null;
  return { key: row.key, nameNo: row.name_no, nameEn: row.name_en };
}
function toCard(row: any): DesignCard {
  return {
    id: row.id,
    slug: row.slug,
    titleNo: row.title_no,
    titleEn: row.title_en ?? null,
    basePrice: row.base_price,
    tileBg: row.tile_bg,
    mockupUrl: row.mockup_url ?? null,
    theme: toNamed(row.theme),
    collection: toNamed(row.collection),
    publishedAt: row.published_at ?? null,
  };
}

const CARD_SELECT =
  "id, slug, title_no, title_en, base_price, tile_bg, mockup_url, published_at, " +
  "theme:themes(key,name_no,name_en), collection:collections(key,name_no,name_en)";

async function resolveId(
  table: "collections" | "themes",
  key: string,
): Promise<string | null> {
  const { data } = await supabasePublic()
    .from(table)
    .select("id")
    .eq("key", key)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Listing ──────────────────────────────────────────────────
export async function listDesigns(params: ListParams): Promise<ListResult> {
  const db = supabasePublic();
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Resolve collection/theme keys → ids (filters compose: collection AND theme
  // AND search — 01-design-spec.md). An unknown key yields an empty result.
  let collectionId: string | null | undefined;
  let themeId: string | null | undefined;
  if (params.collection) {
    collectionId = await resolveId("collections", params.collection);
    if (!collectionId) return { designs: [], nextCursor: null, total: 0 };
  }
  if (params.theme) {
    themeId = await resolveId("themes", params.theme);
    if (!themeId) return { designs: [], nextCursor: null, total: 0 };
  }

  // "Nytt i dag" = designs published since local midnight (today's drop).
  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const applyFilters = <T extends { eq: any; ilike: any; gte: any }>(
    query: T,
  ): T => {
    let q: any = query.eq("status", "published");
    if (collectionId) q = q.eq("collection_id", collectionId);
    if (themeId) q = q.eq("theme_id", themeId);
    if (params.q && params.q.trim())
      q = q.ilike("title_no", `%${params.q.trim()}%`);
    if (params.onlyNew) q = q.gte("published_at", startOfToday);
    return q;
  };

  // Total count for the "{n} design" label (head request, no rows).
  const countQuery = applyFilters(
    db.from("designs").select("id", { count: "exact", head: true }),
  );
  const { count } = await countQuery;

  // Page rows, keyset-ordered.
  let rows: any = applyFilters(db.from("designs").select(CARD_SELECT))
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const cur = parseCursor(params.cursor);
  if (cur) {
    rows = rows.or(
      `published_at.lt."${cur.ts}",and(published_at.eq."${cur.ts}",id.lt.${cur.id})`,
    );
  }

  const { data, error } = await rows;
  if (error) throw new Error(`listDesigns: ${error.message}`);

  const list: any[] = data ?? [];
  const hasMore = list.length > limit;
  const page = hasMore ? list.slice(0, limit) : list;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(last.published_at, last.id) : null;

  return {
    designs: page.map(toCard),
    nextCursor,
    total: count ?? page.length,
  };
}

// ── Product detail ───────────────────────────────────────────
export async function getDesignBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const db = supabasePublic();

  const { data, error } = await db
    .from("designs")
    .select(
      "id, slug, title_no, title_en, description_no, description_en, base_price, tile_bg, mockup_url, detail_url, " +
        "theme:themes(key,name_no,name_en), collection:collections(key,name_no,name_en), " +
        "variants(id, sku, price, active, " +
        "color:garment_colors(key,name_no,name_en,hex,sort_order), " +
        "size:garment_sizes(key,label,price_delta,sort_order))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw new Error(`getDesignBySlug: ${error.message}`);
  if (!data) return null;
  const d: any = data;

  const activeVariants: any[] = (d.variants ?? []).filter(
    (v: any) => v.active !== false && v.color && v.size,
  );

  const colorMap = new Map<string, ProductColor>();
  const sizeMap = new Map<string, ProductSize>();
  const variants: ProductVariant[] = [];

  for (const v of activeVariants) {
    if (!colorMap.has(v.color.key)) {
      colorMap.set(v.color.key, {
        key: v.color.key,
        nameNo: v.color.name_no,
        nameEn: v.color.name_en,
        hex: v.color.hex,
        sortOrder: v.color.sort_order,
      });
    }
    if (!sizeMap.has(v.size.key)) {
      sizeMap.set(v.size.key, {
        key: v.size.key,
        label: v.size.label,
        price: v.price,
        sortOrder: v.size.sort_order,
      });
    }
    variants.push({
      id: v.id,
      sku: v.sku,
      colorKey: v.color.key,
      sizeKey: v.size.key,
      price: v.price,
    });
  }

  const colors = [...colorMap.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const sizes = [...sizeMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  // Related: newest from the same collection, excluding this design.
  let related: DesignCard[] = [];
  if (d.collection) {
    const collId = await resolveId("collections", d.collection.key);
    if (collId) {
      const { data: rel } = await db
        .from("designs")
        .select(CARD_SELECT)
        .eq("status", "published")
        .eq("collection_id", collId)
        .neq("slug", slug)
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(4);
      related = (rel ?? []).map(toCard);
    }
  }

  return {
    id: d.id,
    slug: d.slug,
    titleNo: d.title_no,
    titleEn: d.title_en ?? null,
    descriptionNo: d.description_no ?? null,
    descriptionEn: d.description_en ?? null,
    basePrice: d.base_price,
    tileBg: d.tile_bg,
    mockupUrl: d.mockup_url ?? null,
    detailUrl: d.detail_url ?? null,
    theme: toNamed(d.theme),
    collection: toNamed(d.collection),
    colors,
    sizes,
    variants,
    related,
  };
}

// ── Facets ───────────────────────────────────────────────────
export async function getFacets(): Promise<Facets> {
  const db = supabasePublic();
  const { data, error } = await db.rpc("catalog_facets");
  if (error) throw new Error(`getFacets: ${error.message}`);
  const raw: any = data ?? {};
  return {
    publishedCount: raw.published_count ?? 0,
    collections: (raw.collections ?? []).map((c: any) => ({
      key: c.key,
      nameNo: c.name_no,
      nameEn: c.name_en,
      tileBg: c.tile_bg,
      featureMonths: c.feature_months ?? [],
      designCount: c.design_count ?? 0,
    })),
    themes: (raw.themes ?? []).map((t: any) => ({
      key: t.key,
      nameNo: t.name_no,
      nameEn: t.name_en,
      designCount: t.design_count ?? 0,
    })),
    colors: (raw.colors ?? []).map((c: any) => ({
      key: c.key,
      nameNo: c.name_no,
      nameEn: c.name_en,
      hex: c.hex,
    })),
    sizes: (raw.sizes ?? []).map((s: any) => ({
      key: s.key,
      label: s.label,
    })),
  };
}
