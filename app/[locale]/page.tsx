import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import ScrollReset from "@/components/layout/ScrollReset";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import FleetSection from "@/components/sections/FleetSection";
import PricingSection from "@/components/sections/PricingSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import I18nProvider from "@/components/language/I18nProvider";
import { getPublicRoutes } from "@/lib/pricing-service";
import { SHARED_OG } from "@/lib/seo";
import { messagesFor, metaString } from "@/lib/messages-server";
import {
  PREFIXED_LOCALES,
  alternatesFor,
  type SupportedLocale,
} from "@/lib/i18n";

/**
 * The homepage in the seven languages the site already speaks.
 *
 * The translations existed for months but lived only in React state, so every
 * language shared the single URL "/" and Google indexed nothing but English.
 * Giving each locale its own address is what makes them findable.
 *
 * English deliberately keeps the bare "/" in app/page.tsx: moving it would
 * throw away every link and ranking that URL has earned.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = raw as SupportedLocale;
  const title = metaString(locale, "homeTitle");
  const description = metaString(locale, "homeDescription");

  return {
    title: { absolute: title },
    description,
    // Self-referencing canonical plus the full hreflang set. Pointing these at
    // the English page instead would tell Google the translations are
    // duplicates and none of them would ever be indexed.
    alternates: alternatesFor("/", locale),
    openGraph: {
      ...SHARED_OG,
      title,
      description,
      url: `https://www.elitebcn.info/${locale}`,
      locale,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function LocalizedHomePage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: raw } = await params;
  const locale = raw as SupportedLocale;
  if (!PREFIXED_LOCALES.includes(locale as never)) notFound();

  const routes = await getPublicRoutes();

  return (
    <I18nProvider initialLocale={locale} initialMessages={messagesFor(locale)}>
      {/*
        Corrects <html lang> and, for Arabic, its direction.

        The root layout hardcodes lang="en" and sets no dir at all, so every
        one of these eight translated homepages was served as English to a
        screen reader, and the Arabic page was laid out left-to-right with
        Arabic text inside it. That mis-set direction is the most likely cause
        of /ar being the only route on the site that fails Cumulative Layout
        Shift — 0.122 against 0.000 nearly everywhere else.

        Done as a blocking inline script rather than a React effect because it
        has to happen before first paint; setting direction after hydration
        would cause exactly the shift it is meant to prevent. <html> belongs to
        the root layout and a nested route cannot re-render it, so the proper
        fix is moving the whole app under a [locale] segment — a restructure,
        not a patch. This corrects what a real visitor gets in the meantime;
        crawlers already have the hreflang set.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            `document.documentElement.lang=${JSON.stringify(locale)};` +
            (locale === "ar" ? `document.documentElement.dir="rtl";` : `document.documentElement.dir="ltr";`),
        }}
      />
      <ScrollReset />
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <FleetSection />
        <PricingSection routes={routes} />
        {/*
          The reviews are real customer writing and stay in the language each
          person wrote in — translating somebody's review would put words in
          their mouth.

          HowItWorksSection and FAQSection are missing here on purpose. Their
          prose lives in English inside the components, and printing two
          thousand English words under a French heading would make this a
          half-translated page rather than a French one. They return once the
          copy itself is translated.
        */}
        <TestimonialsSection />
      </main>
      <InstallPrompt />
      <Footer />
    </I18nProvider>
  );
}
