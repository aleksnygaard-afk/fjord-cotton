"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart-provider";
import { localePath } from "@/lib/i18n";
import { formatKr } from "@/lib/money";
import { computeTotals } from "@/lib/cart-totals";

/**
 * Cart page (01-design-spec.md §5). 1080px, two columns. Uses the localStorage
 * cart from CartProvider. VAT rows are hidden until registration is approved
 * (05-norwegian-compliance.md) via the `vatRegistered` flag.
 */
export function CartView({ vatRegistered }: { vatRegistered: boolean }) {
  const { locale, dict } = useI18n();
  const { lines, setQty, remove, hydrated } = useCart();

  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  // No shipping method is chosen yet on the cart page — default to pick-up (free).
  const totals = computeTotals(subtotal, "pickup", vatRegistered);

  const stepBtn: React.CSSProperties = {
    fontFamily: "inherit",
    width: 26,
    height: 26,
    border: "1px solid var(--line-strong)",
    background: "none",
    cursor: "pointer",
    borderRadius: 2,
  };

  return (
    <main
      style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 32px 90px", width: "100%" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 52,
          margin: "0 0 32px",
          letterSpacing: "-0.02em",
        }}
      >
        {dict.cartTitle}
      </h1>

      {!hydrated ? null : lines.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 56,
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 20px", color: "var(--muted)" }}>
            {dict.cartEmpty}
          </p>
          <Link
            href={localePath(locale, "/katalog")}
            className="fc-btn-primary"
            style={{ display: "inline-block", fontSize: 13, padding: "14px 28px" }}
          >
            {dict.browseDesigns}
          </Link>
        </div>
      ) : (
        <div className="fc-cart-shell">
          <div>
            {lines.map((l) => {
              const title =
                locale === "en" ? (l.titleEn ?? l.titleNo) : l.titleNo;
              const colorName = locale === "en" ? l.colorEn : l.colorNo;
              return (
                <div
                  key={l.variantId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "86px 1fr auto",
                    gap: 20,
                    alignItems: "center",
                    padding: "20px 0",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <div
                    style={{
                      aspectRatio: "4 / 5",
                      background: l.tileBg,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    {l.mockupUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.mockupUrl}
                        alt={title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                      }}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--faint)",
                        marginTop: 4,
                      }}
                    >
                      {colorName} · {l.sizeLabel}
                    </div>
                    <button
                      onClick={() => remove(l.variantId)}
                      style={{
                        fontFamily: "inherit",
                        fontSize: 12,
                        background: "none",
                        border: "none",
                        padding: "6px 0 0",
                        cursor: "pointer",
                        color: "var(--accent)",
                      }}
                    >
                      {dict.remove}
                    </button>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15 }}>
                      {formatKr(l.unitPrice * l.qty)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "flex-end",
                        marginTop: 8,
                      }}
                    >
                      <button
                        aria-label="−"
                        onClick={() => setQty(l.variantId, l.qty - 1)}
                        style={stepBtn}
                      >
                        −
                      </button>
                      <span
                        style={{ fontSize: 13, width: 16, textAlign: "center" }}
                      >
                        {l.qty}
                      </span>
                      <button
                        aria-label="+"
                        onClick={() => setQty(l.variantId, l.qty + 1)}
                        style={stepBtn}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              border: "1px solid var(--line)",
              background: "var(--surface)",
              padding: 26,
            }}
          >
            <SummaryRow label={dict.subtotal} value={formatKr(totals.subtotal)} />
            <SummaryRow
              label={dict.shipping}
              value={totals.shipping === 0 ? dict.free : formatKr(totals.shipping)}
            />
            {totals.vat !== null && (
              <SummaryRow
                label={dict.vatOf}
                value={formatKr(totals.vat)}
                muted
              />
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 19,
                borderTop: "1px solid var(--line)",
                paddingTop: 14,
                marginTop: 4,
                marginBottom: 20,
              }}
            >
              <span>{dict.total}</span>
              <span>{formatKr(totals.total)}</span>
            </div>
            <Link
              href={localePath(locale, "/kasse")}
              className="fc-btn-primary"
              style={{
                display: "block",
                textAlign: "center",
                fontSize: 14,
                padding: 16,
              }}
            >
              {dict.toCheckout}
            </Link>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 16,
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "var(--faint)",
                textTransform: "uppercase",
              }}
            >
              Vipps · Klarna · Visa · Apple Pay
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        paddingBottom: 10,
        color: muted ? "var(--faint)" : "inherit",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
