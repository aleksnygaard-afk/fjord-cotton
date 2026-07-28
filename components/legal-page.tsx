import type { Locale } from "@/lib/i18n";

/**
 * Shared shell for the legal / policy pages (05-norwegian-compliance.md).
 * Server component — pages pass locale-selected content as children.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "64px 32px 100px",
        width: "100%",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--faint)",
          marginBottom: 18,
        }}
      >
        {eyebrow}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 52,
          lineHeight: 1.02,
          letterSpacing: "-0.02em",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h1>
      {updated && (
        <div style={{ fontSize: 12, color: "var(--faint)", marginBottom: 28 }}>
          {updated}
        </div>
      )}
      <div className="fc-prose">{children}</div>
    </main>
  );
}

export function localeText<T>(locale: Locale, no: T, en: T): T {
  return locale === "en" ? en : no;
}
