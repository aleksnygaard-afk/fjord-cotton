import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { LegalPage, localeText } from "@/components/legal-page";
import { COMPANY, orgNrDisplay } from "@/lib/company";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Personvern / GDPR (05-norwegian-compliance.md): data collected, purpose, legal
 * basis, processors (by name), retention, user rights, contact. Order data is
 * kept 5 years for bookkeeping (overrides deletion of the order itself).
 */
export default async function PrivacyPage({
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
      eyebrow={t("Personvern", "Privacy")}
      title={t("Personvernerklæring", "Privacy policy")}
      updated={t("Sist oppdatert 2026", "Last updated 2026")}
    >
      <p>
        {t(
          `${COMPANY.legalName} (org.nr ${orgNrDisplay(env.vatRegistered)}) er behandlingsansvarlig for personopplysningene vi samler inn når du handler hos ${COMPANY.brand}. Vi behandler opplysninger i tråd med personvernforordningen (GDPR).`,
          `${COMPANY.legalName} (org.nr ${orgNrDisplay(env.vatRegistered)}) is the data controller for the personal data we collect when you shop at ${COMPANY.brand}. We process data in accordance with the GDPR.`,
        )}
      </p>

      <h2>{t("Hvilke opplysninger vi samler inn", "What we collect")}</h2>
      <ul>
        <li>{t("Navn, e-post, adresse og telefonnummer", "Name, email, address and phone number")}</li>
        <li>{t("Ordre- og betalingsinformasjon", "Order and payment information")}</li>
        <li>{t("Teknisk informasjon som er nødvendig for at nettbutikken skal fungere (f.eks. handlekurv-økt)", "Technical information required for the shop to work (e.g. cart session)")}</li>
      </ul>

      <h2>{t("Formål og behandlingsgrunnlag", "Purpose and legal basis")}</h2>
      <ul>
        <li>{t("Gjennomføre kjøpet og levere varen – oppfyllelse av avtale (GDPR art. 6 nr. 1 b).", "Fulfil the purchase and deliver – performance of a contract (GDPR art. 6(1)(b)).")}</li>
        <li>{t("Bokføring og oppbevaring av salgsdokumentasjon – rettslig forpliktelse (art. 6 nr. 1 c).", "Bookkeeping and retention of sales records – legal obligation (art. 6(1)(c)).")}</li>
        <li>{t("Kundeservice og reklamasjon – berettiget interesse (art. 6 nr. 1 f).", "Customer service and complaints – legitimate interest (art. 6(1)(f)).")}</li>
      </ul>

      <h2>{t("Databehandlere", "Processors")}</h2>
      <p>{t("Vi deler opplysninger med følgende databehandlere, kun i den grad det er nødvendig:", "We share data with the following processors, only as necessary:")}</p>
      <ul>
        <li>{t("Stripe (betaling)", "Stripe (payment)")}</li>
        <li>{t("Gelato (navn og adresse for produksjon og forsendelse)", "Gelato (name and address for production and shipping)")}</li>
        <li>{t("Vår e-postleverandør (kvitteringer og kundeservice)", "Our email provider (receipts and customer service)")}</li>
        <li>{t("Supabase (database/lagring) og Vercel (drift) – begge i EU/EØS", "Supabase (database/storage) and Vercel (hosting) – both in the EU/EEA")}</li>
      </ul>
      <p>{t("Vi tilstreber å holde personopplysninger innenfor EU/EØS.", "We aim to keep personal data within the EU/EEA.")}</p>

      <h2>{t("Lagringstid", "Retention")}</h2>
      <p>
        {t(
          "Ordre- og salgsdokumentasjon oppbevares i 5 år som følge av bokføringsloven. Denne plikten går foran en eventuell sletteanmodning for selve ordren. Opplysninger som kun brukes til markedsføring slettes på forespørsel.",
          "Order and sales records are kept for 5 years under the Bookkeeping Act. This obligation takes precedence over a deletion request for the order itself. Data used only for marketing is deleted on request.",
        )}
      </p>

      <h2>{t("Dine rettigheter", "Your rights")}</h2>
      <p>
        {t(
          "Du har rett til innsyn, retting, sletting og dataportabilitet, og til å protestere mot eller begrense behandlingen, innenfor lovens rammer. Kontakt oss på ",
          "You have the right to access, rectification, erasure and data portability, and to object to or restrict processing, within the limits of the law. Contact us at ",
        )}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        {t(". Du kan også klage til Datatilsynet.", ". You may also lodge a complaint with the Norwegian Data Protection Authority.")}
      </p>

      <h2>{t("Informasjonskapsler (cookies)", "Cookies")}</h2>
      <p>
        {t(
          "Vi bruker kun nødvendige informasjonskapsler for at handlekurven og betalingen skal fungere. Disse krever ikke samtykke. Vi bruker foreløpig ikke analyse- eller markedsføringskapsler; skulle det endre seg, ber vi om samtykke først.",
          "We use only essential cookies needed for the cart and payment to work. These do not require consent. We currently use no analytics or marketing cookies; if that changes, we will ask for consent first.",
        )}
      </p>
    </LegalPage>
  );
}
