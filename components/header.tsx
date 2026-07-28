"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart-provider";
import { localePath, otherLocaleLabel, locales } from "@/lib/i18n";

export function Header() {
  const { locale, dict } = useI18n();
  const { count } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(
      localePath(locale, `/katalog${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    );
  }

  function toggleLang() {
    const other = otherLocaleLabel(locale).toLowerCase() as (typeof locales)[number];
    // Swap the leading /no or /en segment, preserve the rest + query.
    const rest = pathname.replace(/^\/(no|en)/, "") || "/";
    const qs = searchParams.toString();
    router.push(`/${other}${rest === "/" ? "" : rest}${qs ? `?${qs}` : ""}`);
  }

  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    letterSpacing: "0.03em",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(247,245,240,0.94)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "18px 32px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 32,
        }}
      >
        <nav style={{ display: "flex", gap: 26 }}>
          <Link href={localePath(locale, "/katalog")} style={linkStyle}>
            {dict.navAll}
          </Link>
          <Link href={localePath(locale, "/katalog?new=1")} style={linkStyle}>
            {dict.navNew}
          </Link>
          <Link href={localePath(locale, "/katalog")} style={linkStyle}>
            {dict.navCollections}
          </Link>
        </nav>

        <Link
          href={localePath(locale, "/")}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          Fjord &amp; Cotton
        </Link>

        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <form
            onSubmit={submitSearch}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              borderRadius: 2,
              padding: "8px 12px",
              width: 230,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                border: "1.5px solid var(--faint)",
                borderRadius: "50%",
                flex: "none",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.searchPlaceholder}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 12,
                width: "100%",
                color: "var(--ink)",
              }}
            />
          </form>

          <button
            onClick={toggleLang}
            style={{
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: "0.12em",
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 2,
              padding: "8px 10px",
              cursor: "pointer",
              color: "var(--ink)",
            }}
          >
            {otherLocaleLabel(locale)}
          </button>

          <Link
            href={localePath(locale, "/handlekurv")}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              background: "var(--ink)",
              color: "var(--bg)",
              borderRadius: 2,
              padding: "10px 16px",
              display: "flex",
              gap: 8,
            }}
          >
            <span>{dict.cart}</span>
            <span>{count}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
