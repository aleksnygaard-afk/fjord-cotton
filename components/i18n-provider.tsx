"use client";

import { createContext, useContext, useEffect } from "react";
import { getDict, type Locale } from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  dict: ReturnType<typeof getDict>;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Provides locale + message dict to client components. Only the locale string
 * crosses the server→client boundary; the dict (which contains template
 * functions) is resolved here inside the client bundle, so it stays callable.
 *
 * Also mirrors the locale onto <html lang> for a11y/SEO, since the root layout
 * cannot see the [locale] route param.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, dict: getDict(locale) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
