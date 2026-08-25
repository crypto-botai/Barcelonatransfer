import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import ScrollReset from "@/components/layout/ScrollReset";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import FleetSection from "@/components/sections/FleetSection";
import PricingSection from "@/components/sections/PricingSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FAQSection from "@/components/sections/FAQSection";
import { getPublicRoutes } from "@/lib/pricing-service";
import { SHARED_OG } from "@/lib/seo";
import { alternatesFor } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { absolute: "Elite BCN | Barcelona Airport Transfers & Private Chauffeur" },
  description:
    "Private car and driver from Barcelona Airport, T1 and T2. Fixed price per vehicle from €50, with 60 minutes of free waiting from the moment you land.",
  // Canonical plus hreflang for all eight languages. Every locale must list
  // every other one, itself included, or Google discards the set.
  alternates: alternatesFor("/"),
  keywords: ["barcelona airport transfer", "barcelona private transfer", "bcn el prat transfer", "luxury chauffeur barcelona", "mercedes v class barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "Elite BCN | Barcelona Airport Transfers — From €50",
    description: "Barcelona's #1 luxury private transfer. Fixed prices from €50, no surge pricing. BCN El Prat T1/T2. Mercedes V-Class & EQE 300 Electric. Book 24/7.",
    url: "https://www.elitebcn.info",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
};

export default async function HomePage() {
  const routes = await getPublicRoutes();

  return (
    <>
      <ScrollReset />
      <Navbar />
      {/* Everything below the hero is wrapped in .defer-render: the browser
          skips layout and paint for these until they near the viewport. The
          markup is unchanged, so the HTML a crawler receives is identical. */}
      <main>
        <HeroSection />
        <div className="defer-render">
          <ServicesSection />
        </div>
        <div className="defer-render">
          <FleetSection />
        </div>
        <div className="defer-render">
          <PricingSection routes={routes} />
        </div>
        {/* Reviews come straight after the price: the reader who has just seen
            what it costs is the one who wants to know whether it is any good.
            The explanation of how a transfer works sits below them — it answers
            questions somebody already interested will have. */}
        <div className="defer-render">
          <TestimonialsSection />
        </div>
        <div className="defer-render">
          <HowItWorksSection />
        </div>
        <div className="defer-render">
          <FAQSection />
        </div>
      </main>
      <InstallPrompt />
      <Footer />
    </>
  );
}
