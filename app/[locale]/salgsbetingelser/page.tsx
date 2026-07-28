import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { LegalPage, localeText } from "@/components/legal-page";
import { COMPANY, orgNrDisplay } from "@/lib/company";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Salgsbetingelser (05-norwegian-compliance.md). Must contain: company name,
 * org.nr, address, email; prices incl. VAT; delivery times; payment methods;
 * angrerett; complaints; dispute resolution. Starting point — align with the
 * Forbrukertilsynet standard template before go-live.
 */
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = <T,>(no: T, en: T) => localeText(locale, no, en);
  const vat = env.vatRegistered;

  return (
    <LegalPage
      eyebrow={t("Vilkår", "Terms")}
      title={t("Salgsbetingelser", "Terms of sale")}
      updated={t("Sist oppdatert 2026", "Last updated 2026")}
    >
      <p>
        {t(
          "Disse salgsbetingelsene gjelder for salg fra ",
          "These terms of sale apply to purchases from ",
        )}
        <strong>{COMPANY.brand}</strong>
        {t(", drevet av ", ", operated by ")}
        <strong>{COMPANY.legalName}</strong>
        {t(", org.nr ", ", org.nr ")}
        {orgNrDisplay(vat)}
        {t(
          ", til forbrukere i Norge. Avtalen reguleres blant annet av forbrukerkjøpsloven, angrerettloven og markedsføringsloven.",
          ", to consumers in Norway. The agreement is governed by, among others, the Consumer Purchases Act, the Right of Withdrawal Act and the Marketing Control Act.",
        )}
      </p>

      <h2>{t("1. Selger og kontakt", "1. Seller and contact")}</h2>
      <p>
        {COMPANY.legalName}
        {t(" (org.nr ", " (org.nr ")}
        {orgNrDisplay(vat)}
        {t(
          `), ${COMPANY.country}. E-post: `,
          `), ${COMPANY.country}. Email: `,
        )}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>{t("2. Priser og betaling", "2. Prices and payment")}</h2>
      <p>
        {vat
          ? t(
              "Alle priser er oppgitt i norske kroner (NOK) inkludert 25 % merverdiavgift. Frakt kommer i tillegg der det er oppgitt.",
              "All prices are shown in Norwegian kroner (NOK) including 25 % VAT. Shipping is added where stated.",
            )
          : t(
              "Alle priser er oppgitt i norske kroner (NOK). Virksomheten er under registrering i Merverdiavgiftsregisteret; inntil registreringen er godkjent beregnes det ikke merverdiavgift på salget. Frakt kommer i tillegg der det er oppgitt.",
              "All prices are shown in Norwegian kroner (NOK). The business is in the process of VAT registration; until it is approved, no VAT is charged on sales. Shipping is added where stated.",
            )}
      </p>
      <p>
        {t(
          "Betaling skjer via vår betalingsleverandør Dintero, som tilbyr Vipps, Klarna, kort (Visa/Mastercard) og Apple Pay / Google Pay. Beløpet trekkes når bestillingen bekreftes.",
          "Payment is handled by our provider Dintero, offering Vipps, Klarna, card (Visa/Mastercard) and Apple Pay / Google Pay. The amount is charged when the order is confirmed.",
        )}
      </p>

      <h2>{t("3. Bestilling og avtale", "3. Order and agreement")}</h2>
      <p>
        {t(
          "Avtalen er bindende når bestillingen er bekreftet og betalingen er gjennomført. Du mottar en ordrebekreftelse på e-post med ordrenummer og en oppsummering av kjøpet. Produktene trykkes på bestilling.",
          "The agreement is binding once the order is confirmed and payment completed. You receive an order confirmation by email with an order number and a summary. Products are printed to order.",
        )}
      </p>

      <h2>{t("4. Levering", "4. Delivery")}</h2>
      <p>
        {t(
          "Vi trykker og sender fra Norge med Posten og Bring. Normal leveringstid er 2–4 virkedager. Fraktalternativer:",
          "We print and ship from Norway with Posten and Bring. Normal delivery is 2–4 working days. Shipping options:",
        )}
      </p>
      <ul>
        <li>{t("Hentested (Posten): 0 kr, 2–4 virkedager", "Pick-up point (Posten): 0 kr, 2–4 working days")}</li>
        <li>{t("Hjem til døra (Bring): 59 kr, 2–3 virkedager", "Home delivery (Bring): 59 kr, 2–3 working days")}</li>
        <li>{t("Ekspress (Bring 09:00): 149 kr, 1 virkedag", "Express (Bring 09:00): 149 kr, 1 working day")}</li>
      </ul>
      <p>
        {t(
          `Fri frakt ved kjøp over ${COMPANY.freeShippingKr} kr. Se `,
          `Free shipping on orders over ${COMPANY.freeShippingKr} kr. See `,
        )}
        <Link href={localePath(locale, "/frakt")}>
          {t("Frakt og levering", "Shipping & delivery")}
        </Link>
        .
      </p>

      <h2>{t("5. Angrerett", "5. Right of withdrawal")}</h2>
      <p>
        {t(
          "Du har 14 dagers angrerett etter angrerettloven, regnet fra du mottar varen. Angreretten gjelder selv om produktene trykkes på bestilling, siden du velger fra et fast sortiment. Se ",
          "You have a 14-day right of withdrawal under the Right of Withdrawal Act, from the day you receive the goods. It applies even though products are printed to order, since you choose from a fixed catalogue. See ",
        )}
        <Link href={localePath(locale, "/angrerett")}>
          {t("Angrerett og retur", "Returns (angrerett)")}
        </Link>
        {t(" og det standardiserte ", " and the standardised ")}
        <Link href={localePath(locale, "/angrerett/skjema")}>
          {t("angrerettskjemaet", "withdrawal form")}
        </Link>
        .
      </p>

      <h2>{t("6. Reklamasjon", "6. Complaints")}</h2>
      <p>
        {t(
          "Etter forbrukerkjøpsloven har du inntil 2 års reklamasjonsrett på mangler som forelå ved levering (sprekk i trykk, sømfeil og lignende). Ta kontakt på e-post, så ordner vi retting, omlevering eller refusjon.",
          "Under the Consumer Purchases Act you have up to 2 years to complain about defects present at delivery (cracked prints, seam failures, etc.). Contact us by email and we will arrange repair, replacement or refund.",
        )}
      </p>

      <h2>{t("7. Konfliktløsning", "7. Dispute resolution")}</h2>
      <p>
        {t(
          "Ved uenighet kan du kontakte Forbrukertilsynet eller bringe saken inn for Forbrukerklageutvalget (forbrukerradet.no). EU-kommisjonens klageportal (ODR) er også tilgjengelig på ec.europa.eu/consumers/odr.",
          "In case of a dispute you may contact the Norwegian Consumer Authority or bring the matter to the Consumer Disputes Committee (forbrukerradet.no). The EU online dispute resolution platform is available at ec.europa.eu/consumers/odr.",
        )}
      </p>
    </LegalPage>
  );
}
