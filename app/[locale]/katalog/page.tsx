import { notFound } from "next/navigation";
import { getDict, isLocale, type Locale } from "@/lib/i18n";
import { getFacets, listDesigns } from "@/lib/catalog";
import { pickName } from "@/lib/catalog-format";
import { CatalogSidebar } from "@/components/catalog-sidebar";
import { CatalogResults } from "@/components/catalog-results";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDict(locale);

  const sp = await searchParams;
  const collection = one(sp.collection);
  const theme = one(sp.theme);
  const q = one(sp.q);
  const color = one(sp.color);
  const size = one(sp.size);
  const onlyNew = one(sp.new) === "1";

  const [facets, result] = await Promise.all([
    getFacets(),
    listDesigns({ collection, theme, q, onlyNew }),
  ]);

  const activeCollection = collection
    ? facets.collections.find((c) => c.key === collection)
    : undefined;
  const activeTheme = theme
    ? facets.themes.find((t) => t.key === theme)
    : undefined;

  const title = onlyNew
    ? dict.newToday
    : activeCollection
      ? pickName(activeCollection, locale)
      : activeTheme
        ? pickName(activeTheme, locale)
        : dict.catalogArchive;

  return (
    <main
      className="fc-catalog-shell"
      style={{ maxWidth: 1360, margin: "0 auto", padding: "44px 32px 80px" }}
    >
      <CatalogSidebar
        collections={facets.collections}
        themes={facets.themes}
        colors={facets.colors}
        sizes={facets.sizes}
        active={{ collection, theme, color, size }}
      />

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 28,
            borderBottom: "1px solid var(--line)",
            paddingBottom: 18,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 40,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {dict.resultCount(result.total)}
          </span>
        </div>

        <CatalogResults
          initialDesigns={result.designs}
          initialCursor={result.nextCursor}
          filters={{ collection, theme, q, onlyNew }}
        />
      </div>
    </main>
  );
}
