import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { LegalPage, localeText } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

/**
 * Frakt og levering (05-norwegian-compliance.md): prices, carriers, delivery
 * times, free-shipping threshold.
 */
export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = <T,>(no: T, en: T) => localeText(locale, no, en);

  return (
    <LegalPage
      eyebrow={t("Levering", "Delivery")}
      title={t("Frakt og levering", "Shipping & delivery")}
      updated={t("Sist oppdatert 2026", "Last updated 2026")}
    >
      <p>
        {t(
          "Alle produkter trykkes på bestilling i Norge og sendes med Posten og Bring. Fordi trykk skjer domestisk er det ingen toll eller importmerverdiavgift, og normal leveringstid er 2–4 virkedager.",
          "All products are printed to order in Norway and sent with Posten and Bring. Because printing is domestic there is no customs or import VAT, and normal delivery is 2–4 working days.",
        )}
      </p>

      <h2>{t("Fraktalternativer og priser", "Options and prices")}</h2>
      <table>
        <thead>
          <tr>
            <th>{t("Metode", "Method")}</th>
            <th>{t("Pris", "Price")}</th>
            <th>{t("Leveringstid", "Delivery time")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t("Hentested — Posten", "Pick-up point — Posten")}</td>
            <td>0 kr</td>
            <td>{t("2–4 virkedager", "2–4 working days")}</td>
          </tr>
          <tr>
            <td>{t("Hjem til døra — Bring", "Home delivery — Bring")}</td>
            <td>59 kr</td>
            <td>{t("2–3 virkedager", "2–3 working days")}</td>
          </tr>
          <tr>
            <td>{t("Ekspress — Bring 09:00", "Express — Bring 09:00")}</td>
            <td>149 kr</td>
            <td>{t("1 virkedag", "1 working day")}</td>
          </tr>
        </tbody>
      </table>

      <h2>{t("Fri frakt", "Free shipping")}</h2>
      <p>
        {t(
          `Vi tilbyr fri frakt (hentested) på alle ordre over ${COMPANY.freeShippingKr} kr. Terskelen beregnes av varesummen før frakt.`,
          `We offer free shipping (pick-up point) on all orders over ${COMPANY.freeShippingKr} kr. The threshold is calculated from the item subtotal before shipping.`,
        )}
      </p>

      <h2>{t("Levering i Norden", "Nordic delivery")}</h2>
      <p>
        {t(
          "Vi leverer i første omgang til Norge. Levering til Sverige, Danmark og Finland åpnes når volumet forsvarer regnskapsføringen (se salgsbetingelser).",
          "We deliver to Norway to begin with. Delivery to Sweden, Denmark and Finland opens once volume justifies the accounting (see terms of sale).",
        )}
      </p>

      <h2>{t("Sporing", "Tracking")}</h2>
      <p>
        {t(
          "Når pakken er sendt, får du et sporingsnummer på e-post og på ordrebekreftelsessiden.",
          "Once your parcel has shipped you receive a tracking number by email and on the order confirmation page.",
        )}
      </p>
    </LegalPage>
  );
}
