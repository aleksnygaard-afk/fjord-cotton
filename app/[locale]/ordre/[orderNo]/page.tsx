import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { OrderStatus } from "@/components/order-status";

export const dynamic = "force-dynamic";

/**
 * Order confirmation (01-design-spec.md §7). return_url from checkout is
 * /[locale]/ordre/[orderNo]?t=<token> (03). The client OrderStatus polls the
 * token-guarded order endpoint and shows "behandler betaling" until the webhook
 * confirms payment.
 */
export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNo: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, orderNo } = await params;
  if (!isLocale(locale)) notFound();
  const { t } = await searchParams;

  return <OrderStatus orderNo={decodeURIComponent(orderNo)} token={t ?? ""} />;
}
