import Link from "next/link";
import { getDict, localePath, type Locale } from "@/lib/i18n";
import { COMPANY, orgNrDisplay } from "@/lib/company";
import { env } from "@/lib/env";

/**
 * Footer (01-design-spec.md §1). Server component. Company details and payment
 * method names are required on the site (05-norwegian-compliance.md).
 */
export function Footer({ locale }: { locale: Locale }) {
  const dict = getDict(locale);

  const colHeading: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--faint)",
    marginBottom: 5,
  };
  const col: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    fontSize: 13,
  };

  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "64px 32px 28px",
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, 1fr)",
          gap: 48,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              marginBottom: 12,
            }}
          >
            Fjord &amp; Cotton
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--muted)",
              margin: "0 0 14px",
              maxWidth: 280,
            }}
          >
            {dict.footerTagline}
          </p>
          <div
            style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.7 }}
          >
            {COMPANY.legalName}
            <br />
            Org.nr {orgNrDisplay(env.vatRegistered)}
            <br />
            {COMPANY.country}
          </div>
        </div>

        <div style={col}>
          <div style={colHeading}>{dict.footerShop}</div>
          <Link href={localePath(locale, "/katalog")}>{dict.navAll}</Link>
          <Link href={localePath(locale, "/katalog?new=1")}>{dict.navNew}</Link>
          <a href="#">{dict.footerSizeGuide}</a>
          <a href="#">{dict.footerGiftCards}</a>
        </div>

        <div style={col}>
          <div style={colHeading}>{dict.footerService}</div>
          <Link href={localePath(locale, "/frakt")}>{dict.footerShipping}</Link>
          <Link href={localePath(locale, "/angrerett")}>{dict.footerReturns}</Link>
          <Link href={localePath(locale, "/salgsbetingelser")}>
            {dict.footerTerms}
          </Link>
          <Link href={localePath(locale, "/personvern")}>
            {dict.footerPrivacy}
          </Link>
        </div>

        <div style={col}>
          <div style={colHeading}>{dict.footerContact}</div>
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          <span style={{ color: "var(--muted)" }}>{dict.footerHours}</span>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "0 32px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          color: "var(--faint)",
          letterSpacing: "0.06em",
        }}
      >
        <span>© 2026 Nygård Multiservice · Fjord &amp; Cotton</span>
        <span>Vipps · Klarna · Visa · Mastercard · Apple Pay · Google Pay</span>
      </div>
    </footer>
  );
}
