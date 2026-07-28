"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import {
  pickName,
  type CollectionFacet,
  type ThemeFacet,
  type ColorFacet,
  type SizeFacet,
} from "@/lib/catalog-format";

/**
 * Catalog sidebar filters (01-design-spec.md §3). Collection, theme, colour,
 * size + "Nullstill filtre". Filters compose via URL search params; the server
 * page re-renders on navigation. Colour and size are visual selectors (as in the
 * prototype) — the composing filters are collection AND theme AND search.
 */
export function CatalogSidebar({
  collections,
  themes,
  colors,
  sizes,
  active,
}: {
  collections: CollectionFacet[];
  themes: ThemeFacet[];
  colors: ColorFacet[];
  sizes: SizeFacet[];
  active: {
    collection?: string;
    theme?: string;
    color?: string;
    size?: string;
  };
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (p.get(key) === value) p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  function clearAll() {
    router.push(pathname);
  }

  const groupLabel: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--faint)",
    marginBottom: 14,
  };
  const rowBtn = (selected: boolean): React.CSSProperties => ({
    fontFamily: "inherit",
    textAlign: "left",
    fontSize: 13,
    padding: "7px 10px",
    border: "none",
    borderRadius: 2,
    cursor: "pointer",
    background: selected ? "var(--ink)" : "transparent",
    color: selected ? "var(--bg)" : "var(--ink)",
    display: "flex",
    justifyContent: "space-between",
  });

  return (
    <aside
      className="fc-catalog-sidebar"
      style={{ alignSelf: "start", position: "sticky", top: 104 }}
    >
      {/* Collection */}
      <div style={groupLabel}>{dict.filterCollection}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          marginBottom: 32,
        }}
      >
        {collections.map((c) => (
          <button
            key={c.key}
            onClick={() => toggle("collection", c.key)}
            style={rowBtn(active.collection === c.key)}
          >
            <span>{pickName(c, locale)}</span>
            <span style={{ opacity: 0.5 }}>{c.designCount}</span>
          </button>
        ))}
      </div>

      {/* Theme */}
      <div style={groupLabel}>{dict.filterTheme}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          marginBottom: 32,
        }}
      >
        {themes.map((t) => (
          <button
            key={t.key}
            onClick={() => toggle("theme", t.key)}
            style={rowBtn(active.theme === t.key)}
          >
            <span>{pickName(t, locale)}</span>
            <span style={{ opacity: 0.5 }}>{t.designCount}</span>
          </button>
        ))}
      </div>

      {/* Colour */}
      <div style={groupLabel}>{dict.filterColour}</div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}
      >
        {colors.map((c) => (
          <button
            key={c.key}
            title={pickName(c, locale)}
            onClick={() => toggle("color", c.key)}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              cursor: "pointer",
              background: c.hex,
              border: "1px solid var(--line-strong)",
              outline: active.color === c.key ? "2px solid var(--ink)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>

      {/* Size */}
      <div style={groupLabel}>{dict.filterSize}</div>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 32 }}
      >
        {sizes.map((s) => {
          const selected = active.size === s.key;
          return (
            <button
              key={s.key}
              onClick={() => toggle("size", s.key)}
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                padding: "6px 10px",
                cursor: "pointer",
                border: "1px solid var(--line-strong)",
                borderRadius: 2,
                background: selected ? "var(--ink)" : "transparent",
                color: selected ? "var(--bg)" : "var(--ink)",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={clearAll}
        style={{
          fontFamily: "inherit",
          fontSize: 12,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--accent)",
          borderBottom: "1px solid var(--accent)",
        }}
      >
        {dict.clearFilters}
      </button>
    </aside>
  );
}
