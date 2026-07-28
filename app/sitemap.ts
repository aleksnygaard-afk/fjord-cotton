import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { getAllPublishedSlugs } from "@/lib/catalog";

// Generated per request (not baked at build): the catalog grows ~10/day, and the
// build environment has no DB. Falls back to the static routes if the DB is down.
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/katalog",
  "/salgsbetingelser",
  "/angrerett",
  "/angrerett/skjema",
  "/personvern",
  "/frakt",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === "/katalog" || path === "" ? "daily" : "monthly",
        priority: path === "" ? 1 : 0.6,
      });
    }
  }

  try {
    const designs = await getAllPublishedSlugs();
    for (const d of designs) {
      const lastModified = d.publishedAt ? new Date(d.publishedAt) : now;
      for (const locale of locales) {
        entries.push({
          url: `${base}/${locale}/design/${d.slug}`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // DB unreachable (e.g. at build) — static routes still make a valid sitemap.
  }

  return entries;
}
