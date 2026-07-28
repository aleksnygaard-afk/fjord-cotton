import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/lib/i18n";
import { LegalPage, localeText } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const dynamic = "force-dynamic";

/**
 * Angrerett og retur (05-norwegian-compliance.md): the 14-day rules, how to
 * return, who pays return postage, and the withdrawal form. The print-on-demand
 * exemption for custom goods does NOT apply — full 14-day withdrawal.
 */
export default async function WithdrawalPage({
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
      eyebrow={t("Forbruker", "Consumer")}
      title={t("Angrerett og retur", "Right of withdrawal & returns")}
      updated={t("Sist oppdatert 2026", "Last updated 2026")}
    >
      <h2>{t("14 dagers angrerett", "14-day right of withdrawal")}</h2>
      <p>
        {t(
          "Som forbruker har du rett til å gå fra kjøpet innen 14 dager uten å oppgi noen grunn (angrerettloven). Fristen løper fra den dagen du mottar varen. Selv om skjortene trykkes på bestilling, gjelder full angrerett, fordi du velger fra et fast sortiment og ikke personaliserer produktet selv.",
          "As a consumer you may withdraw from the purchase within 14 days without giving a reason (Right of Withdrawal Act). The period runs from the day you receive the goods. Even though the shirts are printed to order, full withdrawal applies, because you choose from a fixed catalogue and do not personalise the product yourself.",
        )}
      </p>

      <h2>{t("Slik bruker du angreretten", "How to withdraw")}</h2>
      <ul>
        <li>
          {t(
            "Gi oss beskjed innen 14 dager – på e-post til ",
            "Notify us within 14 days – by email to ",
          )}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          {t(" eller ved å fylle ut ", " or by filling in the ")}
          <Link href={localePath(locale, "/angrerett/skjema")}>
            {t("angrerettskjemaet", "withdrawal form")}
          </Link>
          .
        </li>
        <li>
          {t(
            "Send varen tilbake innen 14 dager etter at du har gitt melding.",
            "Return the item within 14 days of giving notice.",
          )}
        </li>
        <li>
          {t(
            "Varen bør returneres i tilnærmet samme stand og mengde. Du er ansvarlig for eventuell verdireduksjon som skyldes bruk utover det som er nødvendig for å fastslå varens art og egenskaper.",
            "The item should be returned in essentially the same condition. You are liable for any reduction in value resulting from handling beyond what is necessary to establish its nature and characteristics.",
          )}
        </li>
      </ul>

      <h2>{t("Refusjon og returporto", "Refund and return postage")}</h2>
      <p>
        {t(
          "Vi tilbakebetaler alt du har betalt, inkludert de opprinnelige, ordinære fraktkostnadene, innen 14 dager etter at vi har mottatt varen i retur (eller dokumentasjon på at den er sendt). Kostnaden for å sende varen i retur bæres av deg med mindre annet er avtalt.",
          "We refund everything you paid, including the original standard shipping cost, within 14 days of receiving the returned item (or proof that it has been sent). The cost of returning the item is borne by you unless otherwise agreed.",
        )}
      </p>

      <h2>{t("Angrerettskjema", "Withdrawal form")}</h2>
      <p>
        {t(
          "Du kan bruke det standardiserte skjemaet fra Forbrukertilsynet. Det er også vedlagt / lenket i ordrebekreftelsen på e-post.",
          "You may use the standardised form from the Norwegian Consumer Authority. It is also attached / linked in the order confirmation email.",
        )}
      </p>
      <p>
        <Link href={localePath(locale, "/angrerett/skjema")} className="fc-btn-secondary" style={{ display: "inline-block", padding: "10px 20px", fontSize: 13 }}>
          {t("Åpne angrerettskjema", "Open the withdrawal form")}
        </Link>
      </p>
    </LegalPage>
  );
}
