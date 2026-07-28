import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n-provider";
import { CartProvider } from "@/components/cart-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getDict, isLocale } from "@/lib/i18n";

/**
 * Storefront chrome (01-design-spec.md §1): announcement bar, sticky header,
 * footer — wrapped in the i18n and cart providers. The root app/layout.tsx
 * supplies <html>/<body> and the fonts; this layer adds locale + chrome.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);

  return (
    <I18nProvider locale={locale}>
      <CartProvider>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg)",
          }}
        >
          {/* Announcement bar — plain strings, rendered on the server. */}
          <div
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "9px 16px",
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 40,
            }}
          >
            <span>{dict.annFreeShip}</span>
            <span>{dict.annPrinted}</span>
            <span>{dict.annReturn}</span>
          </div>

          <Header />
          {children}
          <Footer locale={locale} />
        </div>
      </CartProvider>
    </I18nProvider>
  );
}
