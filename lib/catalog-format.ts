import type { Locale } from "@/lib/i18n";

/**
 * Client-safe catalog types and pure helpers. Kept out of lib/catalog.ts (which
 * imports "server-only") so client components can use them without pulling the
 * anon DB client into the browser bundle.
 */

export const DEFAULT_LIMIT = 24;
export const LOAD_MORE_STEP = 12; // "Last inn flere" — 12 more per click
export const MAX_LIMIT = 48;

export type Named = { key: string; nameNo: string; nameEn: string };

export type DesignCard = {
  id: string;
  slug: string;
  titleNo: string;
  titleEn: string | null;
  basePrice: number; // øre, gross
  tileBg: string;
  mockupUrl: string | null;
  theme: Named | null;
  collection: Named | null;
  publishedAt: string | null;
};

export type ListParams = {
  collection?: string;
  theme?: string;
  q?: string;
  onlyNew?: boolean;
  cursor?: string | null;
  limit?: number;
};

export type ListResult = {
  designs: DesignCard[];
  nextCursor: string | null;
  total: number;
};

export type CollectionFacet = Named & {
  tileBg: string;
  featureMonths: number[];
  designCount: number;
};
export type ThemeFacet = Named & { designCount: number };
export type ColorFacet = Named & { hex: string };
export type SizeFacet = { key: string; label: string };
export type Facets = {
  publishedCount: number;
  collections: CollectionFacet[];
  themes: ThemeFacet[];
  colors: ColorFacet[];
  sizes: SizeFacet[];
};

export type ProductColor = Named & { hex: string; sortOrder: number };
export type ProductSize = {
  key: string;
  label: string;
  price: number; // øre, gross, incl. size delta
  sortOrder: number;
};
export type ProductVariant = {
  id: string;
  sku: string;
  colorKey: string;
  sizeKey: string;
  price: number;
};
export type ProductDetail = {
  id: string;
  slug: string;
  titleNo: string;
  titleEn: string | null;
  descriptionNo: string | null;
  descriptionEn: string | null;
  basePrice: number;
  tileBg: string;
  mockupUrl: string | null;
  detailUrl: string | null;
  theme: Named | null;
  collection: Named | null;
  colors: ProductColor[];
  sizes: ProductSize[];
  variants: ProductVariant[];
  related: DesignCard[];
};

// ── Localisation helpers ─────────────────────────────────────
export function pickTitle(
  item: { titleNo: string; titleEn: string | null },
  locale: Locale,
): string {
  return locale === "en" ? (item.titleEn ?? item.titleNo) : item.titleNo;
}
export function pickName(n: Named | null, locale: Locale): string {
  if (!n) return "";
  return locale === "en" ? n.nameEn : n.nameNo;
}

/**
 * The three collections to feature on the home page: soonest upcoming occurrence
 * first, excluding any with zero published designs. Score by
 * (month - currentMonth + 12) % 12 so a season that just passed is never
 * featured (01-design-spec.md, 04-gelato-fulfilment.md).
 */
export function featuredCollections(
  collections: CollectionFacet[],
  currentMonth: number,
): CollectionFacet[] {
  const score = (c: CollectionFacet) =>
    c.featureMonths.length === 0
      ? 99
      : Math.min(...c.featureMonths.map((m) => (m - currentMonth + 12) % 12));
  return collections
    .filter((c) => c.designCount > 0)
    .sort((a, b) => score(a) - score(b))
    .slice(0, 3);
}
