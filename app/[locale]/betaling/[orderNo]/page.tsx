import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { MockCheckout } from "@/components/mock-checkout";

export const dynamic = "force-dynamic";

/**
 * Mock Dintero checkout (test mode). Reached only via the session route's mock
 * redirect. In production (real Dintero credentials) the customer is redirected
 * to Dintero's hosted checkout instead and never lands here.
 */
export default async function MockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNo: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, orderNo } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = await searchParams;

  return <MockCheckout orderNo={decodeURIComponent(orderNo)} token={t ?? ""} />;
}
