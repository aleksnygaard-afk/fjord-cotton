import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { env } from "@/lib/env";
import { CartView } from "@/components/cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // VAT rows are hidden until registration is approved (05-norwegian-compliance.md).
  return <CartView vatRegistered={env.vatRegistered} />;
}
