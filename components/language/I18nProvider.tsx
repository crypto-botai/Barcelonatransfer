"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { RTL_LOCALES, LANGUAGE_META, type SupportedLocale } from "@/lib/i18n";

function FontLoader({ locale }: { locale: string }) {
  useEffect(() => {
    const meta = LANGUAGE_META[locale as SupportedLocale];
    if (!meta?.font) return;
    if (document.querySelector(`link[data-i18n-font="${locale}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = meta.font;
    link.setAttribute("data-i18n-font", locale);
    document.head.appendChild(link);
  }, [locale]);
  return null;
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.split("-")[0] || "en";

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = RTL_LOCALES.includes(locale as SupportedLocale) ? "rtl" : "ltr";
  }, [locale]);

  return (
    <>
      <FontLoader locale={locale} />
      {children}
    </>
  );
}
