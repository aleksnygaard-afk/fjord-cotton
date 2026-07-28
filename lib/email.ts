import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { formatKr } from "@/lib/money";
import { COMPANY, orgNrDisplay } from "@/lib/company";

/**
 * Transactional email via Resend (05-norwegian-compliance.md, step 6). When
 * RESEND_API_KEY is absent we run in mock mode: the email is logged, not sent,
 * so the flow is testable offline. Receipts must show the org.nr, the VAT amount
 * and a link to the withdrawal form.
 *
 * Receipts are sent in Norwegian (bokmål) — the legal default; a per-order
 * locale could localise them later.
 */

type Mail = { to: string; subject: string; html: string };

export async function sendEmail(mail: Mail): Promise<{ ok: boolean }> {
  if (env.emailMock) {
    console.log(`[email:mock] → ${mail.to} :: ${mail.subject}`);
    return { ok: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.email.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[email] send failed: ${res.status} ${await res.text()}`);
    return { ok: false };
  }
  return { ok: true };
}

/** Ops alert (e.g. a paid order stuck out of production — step 5). */
export async function sendOpsAlert(subject: string, text: string): Promise<void> {
  await sendEmail({
    to: env.email.opsAlert,
    subject: `[Fjord & Cotton] ${subject}`,
    html: `<pre style="font:14px ui-monospace,Menlo,monospace">${escapeHtml(text)}</pre>`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function receiptHtml(order: any, lines: any[]): string {
  const vat = order.vat_amount > 0;
  const row = (label: string, value: string, muted = false) =>
    `<tr><td style="padding:4px 0;color:${muted ? "#8b8574" : "#46422f"}">${label}</td>
     <td style="padding:4px 0;text-align:right;color:${muted ? "#8b8574" : "#16150f"}">${value}</td></tr>`;

  const lineRows = lines
    .map(
      (l) => `
    <tr>
      <td style="padding:8px 0;border-top:1px solid #e6e0d2">
        ${escapeHtml(l.title)}<br>
        <span style="color:#8b8574;font-size:13px">${escapeHtml(l.color_name)} · ${escapeHtml(l.size_label)}${l.qty > 1 ? ` · ×${l.qty}` : ""}</span>
      </td>
      <td style="padding:8px 0;border-top:1px solid #e6e0d2;text-align:right">${formatKr(l.line_total)}</td>
    </tr>`,
    )
    .join("");

  const site = env.siteUrl;
  return `<!doctype html>
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#16150f;background:#fffdf8;padding:32px;border:1px solid #ddd7c9">
    <div style="font-size:24px;font-weight:bold;margin-bottom:4px">Fjord &amp; Cotton</div>
    <div style="font-size:13px;color:#6d6653;margin-bottom:24px">Kvittering / ordrebekreftelse</div>

    <p style="font-size:15px;line-height:1.6">Takk for bestillingen, ${escapeHtml(order.first_name)}. Vi presser skjorta di og sender den fra Norge.</p>

    <table style="width:100%;font-size:13px;margin:8px 0 16px">
      ${row("Ordrenummer", `<strong>${escapeHtml(order.order_no)}</strong>`)}
      ${row("Dato", new Date(order.paid_at ?? order.created_at).toLocaleDateString("nb-NO"))}
    </table>

    <table style="width:100%;font-size:14px">${lineRows}</table>

    <table style="width:100%;font-size:14px;margin-top:14px;border-top:1px solid #ddd7c9;padding-top:8px">
      ${row("Delsum", formatKr(order.subtotal))}
      ${row("Frakt", order.shipping === 0 ? "Gratis" : formatKr(order.shipping))}
      ${vat ? row("Herav mva (25 %)", formatKr(order.vat_amount), true) : ""}
      ${row("<strong>Totalt</strong>", `<strong>${formatKr(order.total)}</strong>`)}
    </table>

    <div style="font-size:12px;color:#6d6653;line-height:1.7;margin-top:28px;border-top:1px solid #ddd7c9;padding-top:16px">
      ${COMPANY.legalName} · Org.nr ${orgNrDisplay(vat)} · ${COMPANY.country}<br>
      ${COMPANY.email}
    </div>

    <p style="font-size:12px;color:#6d6653;line-height:1.7;margin-top:16px">
      Du har 14 dagers angrerett etter angrerettloven.
      <a href="${site}/no/angrerett/skjema" style="color:#7a5c2e">Angrerettskjema</a> ·
      <a href="${site}/no/salgsbetingelser" style="color:#7a5c2e">Salgsbetingelser</a> ·
      <a href="${site}/no/angrerett" style="color:#7a5c2e">Angrerett og retur</a>
    </p>
  </div>`;
}

/** Send the receipt for a paid order (idempotent caller: fires once on paid). */
export async function sendReceipt(orderNo: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select(
      "id, order_no, email, first_name, subtotal, shipping, total, vat_amount, currency, paid_at, created_at, status",
    )
    .eq("order_no", orderNo)
    .maybeSingle();
  if (!order) return;

  const { data: lines } = await db
    .from("order_lines")
    .select("title, color_name, size_label, qty, line_total")
    .eq("order_id", (order as any).id);

  await sendEmail({
    to: (order as any).email,
    subject: `Ordrebekreftelse ${orderNo} — Fjord & Cotton`,
    html: receiptHtml(order, lines ?? []),
  });
}
