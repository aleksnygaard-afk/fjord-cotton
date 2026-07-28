import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale, localePath } from "@/lib/i18n";
import {
  getFacets,
  listDesigns,
  featuredCollections,
  pickName as pickFacetName,
} from "@/lib/catalog";
import { ProductTile } from "@/components/product-tile";

export const dynamic = "force-dynamic";

const monoCaption: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--muted)",
  background: "var(--bg)",
  padding: "6px 10px",
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);

  const [facets, newest] = await Promise.all([
    getFacets(),
    listDesigns({ limit: 5 }),
  ]);
  const featured = featuredCollections(facets.collections, new Date().getMonth());

  return (
    <main>
      {/* ── Hero ── */}
      <section
        className="fc-grid-hero"
        style={{ maxWidth: 1360, margin: "0 auto", padding: "72px 32px 56px" }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#7a7461",
              marginBottom: 28,
            }}
          >
            {dict.heroIssue}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(52px, 8vw, 104px)",
              lineHeight: 0.94,
              letterSpacing: "-0.025em",
              margin: "0 0 28px",
              textWrap: "balance",
            }}
          >
            {dict.heroTitle}
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              maxWidth: 460,
              color: "var(--body)",
              margin: "0 0 36px",
            }}
          >
            {dict.heroBody}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link
              href={localePath(locale, "/katalog")}
              className="fc-btn-primary"
              style={{ fontSize: 13, letterSpacing: "0.04em", padding: "16px 30px" }}
            >
              {dict.heroBrowse}
            </Link>
            <Link
              href={localePath(locale, "/katalog?new=1")}
              className="fc-btn-secondary"
              style={{ fontSize: 13, letterSpacing: "0.04em", padding: "16px 30px" }}
            >
              {dict.heroToday}
            </Link>
          </div>
        </div>
        <div
          style={{
            aspectRatio: "4 / 5",
            background:
              "repeating-linear-gradient(135deg,#e8e2d3 0 12px,#ded7c5 12px 24px)",
            display: "flex",
            alignItems: "flex-end",
            padding: 20,
            borderRadius: 2,
          }}
        >
          <span style={monoCaption}>{dict.heroCaption}</span>
        </div>
      </section>

      {/* ── Trust bar (published count is a real query result) ── */}
      <section
        style={{
          borderTop: "1px solid var(--line)",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "20px 32px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          <span>{dict.trustPublished(facets.publishedCount)}</span>
          <span>{dict.trustSizes}</span>
          <span>{dict.trustColours}</span>
          <span>{dict.trustCotton}</span>
          <span>{dict.trustPay}</span>
        </div>
      </section>

      {/* ── Nytt i dag ── */}
      <section
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "64px 32px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {dict.newToday}
        </h2>
        <Link
          href={localePath(locale, "/katalog")}
          style={{
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderBottom: "1px solid var(--ink)",
            paddingBottom: 2,
          }}
        >
          {dict.allLink(facets.publishedCount)}
        </Link>
      </section>
      <section
        className="fc-grid-5"
        style={{ maxWidth: 1360, margin: "0 auto", padding: "0 32px 72px" }}
      >
        {newest.designs.map((card) => (
          <ProductTile
            key={card.id}
            card={card}
            locale={locale}
            newBadge={dict.badgeNew}
          />
        ))}
      </section>

      {/* ── Value props (dark band) ── */}
      <section style={{ background: "var(--ink)", color: "var(--bg)" }}>
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "80px 32px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 56,
          }}
          className="fc-grid-3"
        >
          {dict.valueProps.map((vp, i) => (
            <div key={i}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 40,
                  marginBottom: 14,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3
                style={{
                  fontSize: 14,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: "0 0 10px",
                }}
              >
                {vp.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--on-dark)",
                  margin: 0,
                }}
              >
                {vp.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── I sesong nå (seasonal, excludes empty collections) ── */}
      {featured.length > 0 && (
        <section style={{ maxWidth: 1360, margin: "0 auto", padding: "72px 32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 44,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {dict.inSeason}
            </h2>
            <span
              style={{
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--faint)",
              }}
            >
              {dict.seasonsHolidays}
            </span>
          </div>
          <div className="fc-grid-3">
            {featured.map((c) => (
              <Link
                key={c.key}
                href={localePath(locale, `/katalog?collection=${c.key}`)}
                className="fc-tile-collection"
                style={{
                  aspectRatio: "16 / 10",
                  background: c.tileBg,
                  padding: 26,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "#5a5442",
                  }}
                >
                  {dict.designCount(c.designCount)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 32,
                    lineHeight: 1.05,
                  }}
                >
                  {pickFacetName(c, locale)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
