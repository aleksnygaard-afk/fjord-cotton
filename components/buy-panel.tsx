"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart-provider";
import { formatKr } from "@/lib/money";
import { pickName, pickTitle, type ProductDetail } from "@/lib/catalog-format";

/**
 * Product buy panel (01-design-spec.md §4). Colour + size selection, live price
 * (incl. size delta), add-to-cart and the Vipps express button.
 *
 * The cart is wired up here (localStorage, via CartProvider); the cart and
 * checkout PAGES are build-order step 3, so both buttons add to the cart and
 * surface a confirmation rather than navigating to routes that don't exist yet.
 */
export function BuyPanel({ product }: { product: ProductDetail }) {
  const { locale, dict } = useI18n();
  const { add } = useCart();

  const [colorKey, setColorKey] = useState(product.colors[0]?.key ?? "");
  const [sizeKey, setSizeKey] = useState(
    product.sizes.find((s) => s.key === "m")?.key ?? product.sizes[0]?.key ?? "",
  );
  const [added, setAdded] = useState(false);

  const selectedColor = product.colors.find((c) => c.key === colorKey) ?? null;
  const selectedSize = product.sizes.find((s) => s.key === sizeKey) ?? null;
  const variant = useMemo(
    () =>
      product.variants.find(
        (v) => v.colorKey === colorKey && v.sizeKey === sizeKey,
      ) ?? null,
    [product.variants, colorKey, sizeKey],
  );

  const price = variant?.price ?? selectedSize?.price ?? product.basePrice;

  function addToCart() {
    if (!variant || !selectedColor || !selectedSize) return;
    add({
      variantId: variant.id,
      slug: product.slug,
      titleNo: product.titleNo,
      titleEn: product.titleEn,
      colorNo: selectedColor.nameNo,
      colorEn: selectedColor.nameEn,
      sizeLabel: selectedSize.label,
      unitPrice: variant.price,
      tileBg: product.tileBg,
      mockupUrl: product.mockupUrl,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  const eyebrow: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--faint)",
  };

  return (
    <div style={{ position: "sticky", top: 110 }}>
      <div style={{ ...eyebrow, marginBottom: 12 }}>
        {pickName(product.theme, locale)}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 56,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
        }}
      >
        {pickTitle(product, locale)}
      </h1>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{formatKr(price)}</div>
      <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 30 }}>
        {dict.vatLine}
      </div>

      {/* Colour */}
      <div style={{ ...eyebrow, marginBottom: 10 }}>{dict.filterColour}</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
        {product.colors.map((c) => (
          <button
            key={c.key}
            title={pickName(c, locale)}
            onClick={() => setColorKey(c.key)}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              cursor: "pointer",
              background: c.hex,
              border: "1px solid var(--line-strong)",
              outline: colorKey === c.key ? "2px solid var(--ink)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>

      {/* Size */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={eyebrow}>{dict.filterSize}</span>
        <a href="#" style={{ fontSize: 11, color: "var(--accent)" }}>
          {dict.sizeGuide}
        </a>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 6,
          marginBottom: 30,
        }}
      >
        {product.sizes.map((s) => {
          const selected = sizeKey === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSizeKey(s.key)}
              style={{
                fontFamily: "inherit",
                fontSize: 13,
                padding: "12px 0",
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
        onClick={addToCart}
        className="fc-btn-primary"
        style={{
          width: "100%",
          fontSize: 14,
          letterSpacing: "0.04em",
          padding: 18,
          marginBottom: 10,
        }}
      >
        {dict.addToCart(formatKr(price))}
      </button>
      <button
        onClick={addToCart}
        className="fc-btn-vipps"
        style={{
          width: "100%",
          fontSize: 14,
          letterSpacing: "0.04em",
          padding: 18,
          marginBottom: 14,
        }}
      >
        {dict.buyVipps}
      </button>

      <div
        style={{
          minHeight: 18,
          fontSize: 12,
          color: "#4a6b4a",
          textAlign: "center",
          marginBottom: 12,
        }}
        aria-live="polite"
      >
        {added ? `✓ ${dict.addedToCart}` : ""}
      </div>

      {/* Spec block */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: 22,
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--body)",
        }}
      >
        <p style={{ margin: "0 0 14px" }}>
          {(locale === "en"
            ? product.descriptionEn
            : product.descriptionNo) ?? dict.productDesc}
        </p>
        <SpecRow label={dict.specDelivery} value={dict.specDeliveryValue} />
        <SpecRow label={dict.specReturns} value={dict.specReturnsValue} />
        <SpecRow label={dict.specPrinted} value={dict.specPrintedValue} />
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderTop: "1px solid var(--line-soft)",
      }}
    >
      <span>{label}</span>
      <span style={{ color: "var(--faint)" }}>{value}</span>
    </div>
  );
}
