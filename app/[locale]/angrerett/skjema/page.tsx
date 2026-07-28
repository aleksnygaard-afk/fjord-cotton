import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { localeText } from "@/components/legal-page";
import { PrintButton } from "@/components/print-button";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

/**
 * Standardised withdrawal form — Angrerettskjema (05-norwegian-compliance.md).
 * The official Forbrukertilsynet form; the consumer fills it in and returns it.
 * Print-friendly so it can be saved as PDF (Ctrl/Cmd-P → Save as PDF).
 */
export default async function WithdrawalFormPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = <T,>(no: T, en: T) => localeText(locale, no, en);

  const line: React.CSSProperties = {
    borderBottom: "1px solid var(--line-strong)",
    minHeight: 34,
    marginTop: 6,
    marginBottom: 18,
  };

  return (
    <main
      style={{ maxWidth: 680, margin: "0 auto", padding: "56px 32px 100px", width: "100%" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--faint)",
          }}
        >
          {t("Angrerettloven", "Right of Withdrawal Act")}
        </div>
        <PrintButton label={t("Skriv ut / lagre som PDF", "Print / save as PDF")} />
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 44,
          letterSpacing: "-0.02em",
          margin: "0 0 8px",
        }}
      >
        {t("Angrerettskjema", "Withdrawal form")}
      </h1>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 28px" }}>
        {t(
          "(Dette skjemaet fylles ut og returneres bare dersom du ønsker å gå fra avtalen.)",
          "(Complete and return this form only if you wish to withdraw from the contract.)",
        )}
      </p>

      <div className="fc-prose">
        <p>
          <strong>{t("Til:", "To:")}</strong> {COMPANY.legalName}, {COMPANY.country} —{" "}
          {COMPANY.email}
        </p>
        <p>
          {t(
            "Jeg/vi underretter herved om at jeg/vi ønsker å gå fra min/vår avtale om kjøp av følgende varer:",
            "I/we hereby give notice that I/we withdraw from my/our contract of sale of the following goods:",
          )}
        </p>
        <div style={line} />
        <div style={line} />

        <p>{t("Bestilt den / mottatt den:", "Ordered on / received on:")}</p>
        <div style={line} />

        <p>{t("Forbrukerens navn:", "Consumer's name:")}</p>
        <div style={line} />

        <p>{t("Forbrukerens adresse:", "Consumer's address:")}</p>
        <div style={line} />

        <p>
          {t(
            "Forbrukerens underskrift (bare hvis skjemaet meldes på papir):",
            "Consumer's signature (only if this form is notified on paper):",
          )}
        </p>
        <div style={line} />

        <p>{t("Dato:", "Date:")}</p>
        <div style={{ ...line, maxWidth: 200 }} />
      </div>
    </main>
  );
}
