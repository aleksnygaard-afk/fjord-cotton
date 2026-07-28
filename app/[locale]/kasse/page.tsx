import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { env } from "@/lib/env";
import { CheckoutView } from "@/components/checkout-view";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CheckoutView vatRegistered={env.vatRegistered} />;
}
