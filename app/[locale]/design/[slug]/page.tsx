import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDict, isLocale, localePath, type Locale } from "@/lib/i18n";
import { getDesignBySlug } from "@/lib/catalog";
import { pickName, pickTitle } from "@/lib/catalog-format";
import { BuyPanel } from "@/components/buy-panel";
import { ProductTile } from "@/components/product-tile";

export const dynamic = "force-dynamic";

// Deduped across generateMetadata + the page render within one request.
const loadDesign = cache(getDesignBySlug);

const monoCaption: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  background: "var(--bg)",
  padding: "4px 7px",
};

const stripedBg =
  "repeating-linear-gradient(135deg,#e8e2d3 0 10px,#ded7c5 10px 20px)";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const design = await loadDesign(slug);
  if (!design) return {};
  const title = pickTitle(design, locale);
  const desc =
    (locale === "en" ? design.descriptionEn : design.descriptionNo) ??
    (locale === "en"
      ? "Original print on heavy combed cotton, printed in Oslo."
      : "Originalt trykk på tung kammet bomull, trykket i Oslo.");
  return { title: `${title} · Fjord & Cotton`, description: desc };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDict(locale);

  const design = await loadDesign(slug);
  if (!design) notFound();

  return (
    <main
      style={{ maxWidth: 1360, margin: "0 auto", padding: "44px 32px 90px", width: "100%" }}
    >
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 26 }}>
        <Link href={localePath(locale, "/katalog")}>{dict.breadcrumbArchive}</Link>
        {" / "}
        {pickName(design.theme, locale)}
        {" / "}
        {pickTitle(design, locale)}
      </div>

      <div className="fc-product-shell">
        {/* Image grid */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <div
            style={{
              gridColumn: "1 / -1",
              aspectRatio: "1",
              background: design.tileBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {design.mockupUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.mockupUrl}
                alt={pickTitle(design, locale)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "42%",
                  aspectRatio: "1",
                  background:
                    "repeating-linear-gradient(45deg,rgba(22,21,15,0.13) 0 8px,transparent 8px 16px)",
                  border: "1px solid rgba(22,21,15,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "#4a4535",
                  }}
                >
                  {design.slug}
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              aspectRatio: "1",
              background: stripedBg,
              display: "flex",
              alignItems: "flex-end",
              padding: 14,
              borderRadius: 2,
            }}
          >
            <span style={monoCaption}>{dict.modelFront}</span>
          </div>

          <div
            style={{
              aspectRatio: "1",
              background: design.detailUrl ? design.tileBg : stripedBg,
              display: "flex",
              alignItems: "flex-end",
              padding: design.detailUrl ? 0 : 14,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {design.detailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={design.detailUrl}
                alt={dict.printDetail}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={monoCaption}>{dict.printDetail}</span>
            )}
          </div>
        </div>

        {/* Buy panel */}
        <BuyPanel product={design} />
      </div>

      {/* From the same collection */}
      {design.related.length > 0 && (
        <section style={{ marginTop: 80 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              letterSpacing: "-0.02em",
              margin: "0 0 24px",
            }}
          >
            {pickName(design.collection, locale)}
          </h2>
          <div className="fc-grid-4">
            {design.related.map((card) => (
              <ProductTile key={card.id} card={card} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
