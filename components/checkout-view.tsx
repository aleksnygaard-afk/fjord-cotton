"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart-provider";
import { localePath } from "@/lib/i18n";
import { formatKr } from "@/lib/money";
import {
  computeTotals,
  effectiveShipping,
  SHIPPING_METHODS,
  PAYMENT_METHODS,
  PAYMENT_CHIP,
  type ShippingMethod,
  type PaymentMethod,
} from "@/lib/cart-totals";

/**
 * Checkout page (01-design-spec.md §6). Contact + delivery + payment + consent,
 * with a sticky live order summary. VAT rows hidden until registration is
 * approved (05-norwegian-compliance.md).
 *
 * The "Betal" button here is UI only. Real payment is build-order step 4: it
 * will POST /api/checkout/session (which re-prices server-side, inserts a
 * pending order with a sequential order_no, and creates the Dintero session)
 * and redirect to Dintero. For now it generates a placeholder order number,
 * clears the cart and shows the confirmation screen.
 */
export function CheckoutView({ vatRegistered }: { vatRegistered: boolean }) {
  const { locale, dict } = useI18n();
  const { lines, hydrated } = useCart();
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    first: "",
    last: "",
    street: "",
    postcode: "",
    city: "",
    country: "NO",
  });
  const [ship, setShip] = useState<ShippingMethod>("pickup");
  const [pay, setPay] = useState<PaymentMethod>("vipps");
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // An empty cart has nothing to check out — send the customer back.
  useEffect(() => {
    if (hydrated && lines.length === 0) {
      router.replace(localePath(locale, "/handlekurv"));
    }
  }, [hydrated, lines.length, router, locale]);

  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const totals = computeTotals(subtotal, ship, vatRegistered);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const requiredFilled =
    emailValid &&
    form.first.trim() &&
    form.last.trim() &&
    form.street.trim() &&
    form.postcode.trim() &&
    form.city.trim();
  const canSubmit = Boolean(requiredFilled && consent);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function placeOrder() {
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Server re-prices from variants, creates the pending order and the Dintero
      // session (or a mock one), and returns the redirect URL. We send only
      // variant ids + quantities — never prices. The cart is cleared on the
      // confirmation page once the order is confirmed paid, so returning from a
      // cancelled payment keeps the basket intact.
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
          email: form.email.trim(),
          firstName: form.first.trim(),
          lastName: form.last.trim(),
          phone: "",
          address1: form.street.trim(),
          postcode: form.postcode.trim(),
          city: form.city.trim(),
          country: form.country,
          shippingMethod: ship,
          paymentMethod: pay,
          consent: true,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        setSubmitError(data.error ?? dict.payError);
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setSubmitError(dict.payError);
      setSubmitting(false);
    }
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--faint)",
    marginBottom: 14,
  };
  const field = (invalid: boolean): React.CSSProperties => ({
    fontFamily: "inherit",
    fontSize: 14,
    padding: 14,
    border: `1px solid ${invalid ? "#a75c3c" : "var(--line)"}`,
    background: "var(--surface)",
    borderRadius: 2,
    outline: "none",
    width: "100%",
  });
  const invalidWhen = (v: string) => showErrors && !v.trim();

  if (!hydrated || lines.length === 0) {
    return (
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 32px 90px" }} />
    );
  }

  return (
    <main
      className="fc-checkout-shell"
      style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 32px 90px" }}
    >
      {/* ── Left: form ── */}
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 52,
            margin: "0 0 34px",
            letterSpacing: "-0.02em",
          }}
        >
          {dict.checkoutTitle}
        </h1>

        {/* 1 — Contact */}
        <div style={sectionLabel}>{dict.secContact}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 34,
          }}
        >
          <input
            style={{ ...field(showErrors && !emailValid), gridColumn: "1 / -1" }}
            placeholder={dict.phEmail}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <input
            style={field(invalidWhen(form.first))}
            placeholder={dict.phFirst}
            value={form.first}
            onChange={(e) => set("first", e.target.value)}
          />
          <input
            style={field(invalidWhen(form.last))}
            placeholder={dict.phLast}
            value={form.last}
            onChange={(e) => set("last", e.target.value)}
          />
          <input
            style={{ ...field(invalidWhen(form.street)), gridColumn: "1 / -1" }}
            placeholder={dict.phStreet}
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
          />
          <input
            style={field(invalidWhen(form.postcode))}
            placeholder={dict.phPostcode}
            value={form.postcode}
            onChange={(e) => set("postcode", e.target.value)}
          />
          <input
            style={field(invalidWhen(form.city))}
            placeholder={dict.phCity}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
          <select
            style={{ ...field(false), gridColumn: "1 / -1" }}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          >
            {/* Nordic countries per the design. Go-live: restrict to Norway or
                register IOSS for EU VAT (05-norwegian-compliance.md). */}
            {dict.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2 — Delivery */}
        <div style={sectionLabel}>{dict.secDelivery}</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 34,
          }}
        >
          {SHIPPING_METHODS.map((m) => {
            const cost = effectiveShipping(subtotal, m);
            const selected = ship === m;
            return (
              <button
                key={m}
                onClick={() => setShip(m)}
                style={{
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: 16,
                  cursor: "pointer",
                  background: "var(--surface)",
                  border: `1px solid ${selected ? "var(--ink)" : "var(--line)"}`,
                  borderRadius: 2,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 14 }}>{dict.shipMethods[m].name}</span>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {dict.shipMethods[m].eta}
                  </span>
                </span>
                <span style={{ fontSize: 14 }}>
                  {cost === 0 ? dict.free : formatKr(cost)}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3 — Payment */}
        <div style={sectionLabel}>{dict.secPayment}</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {PAYMENT_METHODS.map((m) => {
            const selected = pay === m;
            const info = dict.payMethods[m];
            return (
              <button
                key={m}
                onClick={() => setPay(m)}
                style={{
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: 16,
                  cursor: "pointer",
                  background: "var(--surface)",
                  border: `1px solid ${selected ? "var(--ink)" : "var(--line)"}`,
                  borderRadius: 2,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span
                    style={{
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        width: 34,
                        height: 20,
                        borderRadius: 2,
                        background: PAYMENT_CHIP[m],
                      }}
                    />
                    {info.name}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {info.note}
                  </span>
                </span>
                {info.meta && (
                  <span style={{ fontSize: 12, color: "var(--faint)" }}>
                    {info.meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Consent */}
        <label
          style={{
            display: "flex",
            gap: 10,
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{
              marginTop: 2,
              outline: showErrors && !consent ? "2px solid #a75c3c" : "none",
            }}
          />
          <span>{dict.consent}</span>
        </label>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            fontSize: 12,
            margin: "-14px 0 24px",
          }}
        >
          <Link href={localePath(locale, "/salgsbetingelser")} style={{ color: "var(--accent)" }}>
            {dict.footerTerms}
          </Link>
          <Link href={localePath(locale, "/angrerett")} style={{ color: "var(--accent)" }}>
            {dict.footerReturns}
          </Link>
          <Link href={localePath(locale, "/personvern")} style={{ color: "var(--accent)" }}>
            {dict.footerPrivacy}
          </Link>
        </div>

        <button
          onClick={placeOrder}
          disabled={submitting}
          className="fc-btn-primary"
          style={{
            width: "100%",
            fontSize: 15,
            padding: 19,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? dict.payProcessing
            : dict.payLabel(formatKr(totals.total), dict.payMethods[pay].name)}
        </button>
        {((showErrors && !canSubmit) || submitError) && (
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#a75c3c",
              marginTop: 12,
            }}
          >
            {submitError ?? dict.formError}
          </div>
        )}
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "var(--faint)",
            marginTop: 14,
          }}
        >
          {dict.orderNote}
        </div>
      </div>

      {/* ── Right: order summary ── */}
      <div
        className="fc-checkout-summary"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 26,
          position: "sticky",
          top: 110,
        }}
      >
        <div style={{ ...sectionLabel, marginBottom: 16 }}>{dict.orderSummary}</div>
        {lines.map((l) => {
          const title = locale === "en" ? (l.titleEn ?? l.titleNo) : l.titleNo;
          const colorName = locale === "en" ? l.colorEn : l.colorNo;
          return (
            <div
              key={l.variantId}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                paddingBottom: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  aspectRatio: "4 / 5",
                  background: l.tileBg,
                  borderRadius: 2,
                  flex: "none",
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
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
                {title}
                {l.qty > 1 ? ` ×${l.qty}` : ""}
                <div style={{ color: "var(--faint)", fontSize: 11 }}>
                  {colorName} · {l.sizeLabel}
                </div>
              </div>
              <div style={{ fontSize: 13 }}>{formatKr(l.unitPrice * l.qty)}</div>
            </div>
          );
        })}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            borderTop: "1px solid var(--line)",
            paddingTop: 14,
          }}
        >
          <span>{dict.subtotal}</span>
          <span>{formatKr(totals.subtotal)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            paddingTop: 8,
          }}
        >
          <span>{dict.shipping}</span>
          <span>
            {totals.shipping === 0 ? dict.free : formatKr(totals.shipping)}
          </span>
        </div>
        {totals.vat !== null && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              paddingTop: 8,
              color: "var(--faint)",
            }}
          >
            <span>{dict.vatOfShort}</span>
            <span>{formatKr(totals.vat)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 19,
            borderTop: "1px solid var(--line)",
            marginTop: 14,
            paddingTop: 14,
          }}
        >
          <span>{dict.total}</span>
          <span>{formatKr(totals.total)}</span>
        </div>
      </div>
    </main>
  );
}
