"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart-provider";
import { localePath } from "@/lib/i18n";

/**
 * Order confirmation body (01-design-spec.md §7). Polls the token-guarded
 * /api/orders/[orderNo] until the Dintero webhook has flipped the order to
 * 'paid' — showing "behandler betaling" meanwhile (03, step 5 of the flow).
 * Clears the local cart once the order is confirmed paid.
 */
type Phase = "loading" | "pending" | "paid" | "notfound";

export function OrderStatus({
  orderNo,
  token,
}: {
  orderNo: string;
  token: string;
}) {
  const { locale, dict } = useI18n();
  const { clear } = useCart();
  // If we arrived without a token we can't verify — show the thank-you best-effort.
  const [phase, setPhase] = useState<Phase>(token ? "loading" : "paid");
  const cleared = useRef(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderNo)}?t=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!active) return;
        if (res.status === 404) {
          setPhase("notfound");
          return;
        }
        const data = await res.json();
        if (data.status === "pending") {
          setPhase("pending");
          if (attempts < 24) timer = setTimeout(poll, 2500); // ~60s
          return;
        }
        // paid / in_production / shipped etc. → done.
        setPhase("paid");
      } catch {
        if (active && attempts < 24) timer = setTimeout(poll, 2500);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderNo, token]);

  useEffect(() => {
    if (phase === "paid" && !cleared.current) {
      cleared.current = true;
      clear();
    }
  }, [phase, clear]);

  if (phase === "notfound") {
    return (
      <Centered>
        <p style={{ fontSize: 15, color: "var(--body)", margin: "0 0 34px" }}>
          {dict.confNotFound}
        </p>
        <BackButton />
      </Centered>
    );
  }

  const processing = phase === "loading" || phase === "pending";

  return (
    <Centered>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--faint)",
          marginBottom: 20,
        }}
      >
        {processing ? dict.confProcessingEyebrow : dict.confEyebrow}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 64,
          lineHeight: 1,
          margin: "0 0 20px",
          letterSpacing: "-0.02em",
        }}
      >
        {processing ? dict.confProcessingTitle : dict.confTitle}
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--body)",
          margin: "0 0 34px",
        }}
      >
        {processing ? dict.confProcessingBody : dict.confBody}
      </p>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: 16,
          marginBottom: 34,
        }}
      >
        {dict.confOrderNo}
        {orderNo}
      </div>
      {!processing && (
        <div>
          <BackButton />
        </div>
      )}
    </Centered>
  );

  function BackButton() {
    return (
      <Link
        href={localePath(locale, "/")}
        className="fc-btn-primary"
        style={{ display: "inline-block", fontSize: 13, padding: "15px 32px" }}
      >
        {dict.backToShop}
      </Link>
    );
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "110px 32px 140px",
        textAlign: "center",
        width: "100%",
      }}
    >
      {children}
    </main>
  );
}
