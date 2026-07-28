"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { ProductTile } from "@/components/product-tile";
import { localePath } from "@/lib/i18n";
import { LOAD_MORE_STEP, type DesignCard } from "@/lib/catalog-format";

export type CatalogFilters = {
  collection?: string;
  theme?: string;
  q?: string;
  onlyNew?: boolean;
};

function toQuery(filters: CatalogFilters, extra: Record<string, string>): string {
  const p = new URLSearchParams();
  if (filters.collection) p.set("collection", filters.collection);
  if (filters.theme) p.set("theme", filters.theme);
  if (filters.q) p.set("q", filters.q);
  if (filters.onlyNew) p.set("new", "1");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export function CatalogResults({
  initialDesigns,
  initialCursor,
  filters,
}: {
  initialDesigns: DesignCard[];
  initialCursor: string | null;
  filters: CatalogFilters;
}) {
  const { locale, dict } = useI18n();
  const [designs, setDesigns] = useState<DesignCard[]>(initialDesigns);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(false);
    try {
      const qs = toQuery(filters, {
        cursor,
        limit: String(LOAD_MORE_STEP),
      });
      const res = await fetch(`/api/designs?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        designs: DesignCard[];
        nextCursor: string | null;
      };
      setDesigns((prev) => [...prev, ...data.designs]);
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (designs.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "64px 32px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: 15 }}>
          {dict.emptyLine}
        </p>
        <Link
          href={localePath(locale, "/katalog")}
          className="fc-btn-primary"
          style={{ display: "inline-block", fontSize: 13, padding: "14px 28px" }}
        >
          {dict.backToArchive}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="fc-grid-4">
        {designs.map((card) => (
          <ProductTile key={card.id} card={card} locale={locale} />
        ))}
      </div>

      {cursor && (
        <div style={{ display: "flex", justifyContent: "center", padding: "56px 0 0" }}>
          <button
            onClick={loadMore}
            disabled={loading}
            className="fc-btn-secondary"
            style={{
              fontSize: 13,
              letterSpacing: "0.04em",
              padding: "15px 40px",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "…" : dict.loadMore}
          </button>
        </div>
      )}
      {error && (
        <p
          style={{
            textAlign: "center",
            color: "#a75c3c",
            fontSize: 12,
            marginTop: 12,
          }}
        >
          {locale === "en"
            ? "Could not load more. Try again."
            : "Kunne ikke laste flere. Prøv igjen."}
        </p>
      )}
    </>
  );
}
