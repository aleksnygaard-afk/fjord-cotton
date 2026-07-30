"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { localePath } from "@/lib/i18n";
import { formatKr } from "@/lib/money";

/**
 * Simulated hosted checkout (mock mode only). Stands in for the redirect to
 * Stripe so the order → paid flow is demoable without Stripe keys.
 * "Betal" drives /api/checkout/mock-complete, which runs the same
 * mark_order_paid path the real webhook would.
 */
export function MockCheckout({
  orderNo,
  token,
}: {
  orderNo: string;
  token: string;
}) {
  const { locale, dict } = useI18n();
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(
      `/api/orders/${encodeURIComponent(orderNo)}?t=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setAmount(d.total))
      .catch(() => setError(true));
  }, [orderNo, token]);

  async function pay() {
    setPaying(true);
    try {
      const res = await fetch("/api/checkout/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, t: token }),
      });
      if (!res.ok) throw new Error();
      window.location.href = `${localePath(locale, `/ordre/${orderNo}`)}?t=${encodeURIComponent(token)}`;
    } catch {
      setError(true);
      setPaying(false);
    }
  }

  function cancel() {
    window.location.href = localePath(locale, "/handlekurv");
  }

  return (
    <main
      style={{
        maxWidth: 460,
        margin: "0 auto",
        padding: "90px 32px 140px",
        width: "100%",
      }}
    >
      <div
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          borderRadius: 2,
          padding: 32,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginBottom: 12,
          }}
        >
          {dict.mockEyebrow}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            letterSpacing: "-0.02em",
            margin: "0 0 10px",
          }}
        >
          {dict.mockTitle}
        </h1>
        <p style={{ fontSize: 14, color: "var(--body)", margin: "0 0 24px" }}>
          {dict.mockBody}
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 18,
            borderTop: "1px solid var(--line)",
            paddingTop: 18,
            marginBottom: 24,
          }}
        >
          <span>{dict.mockAmount}</span>
          <span>{amount !== null ? formatKr(amount) : "—"}</span>
        </div>

        <button
          onClick={pay}
          disabled={paying || amount === null}
          className="fc-btn-primary"
          style={{
            width: "100%",
            fontSize: 15,
            padding: 18,
            marginBottom: 10,
            opacity: paying || amount === null ? 0.6 : 1,
          }}
        >
          {dict.mockPay}
        </button>
        <button
          onClick={cancel}
          className="fc-btn-secondary"
          style={{ width: "100%", fontSize: 14, padding: 16 }}
        >
          {dict.mockCancel}
        </button>

        {error && (
          <p style={{ color: "#a75c3c", fontSize: 12, marginTop: 14 }}>
            {dict.confNotFound}
          </p>
        )}
      </div>
    </main>
  );
}
