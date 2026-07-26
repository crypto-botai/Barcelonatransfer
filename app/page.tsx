import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollReset from "@/components/layout/ScrollReset";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import FleetSection from "@/components/sections/FleetSection";
import PricingSection from "@/components/sections/PricingSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import FAQSection from "@/components/sections/FAQSection";
import { getPublicRoutes } from "@/lib/pricing-service";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Élite BCN | Barcelona Airport Transfers — From €50" },
  description:
    "Barcelona's #1 luxury private transfer. Fixed prices from €50, no surge. BCN El Prat T1/T2, cruise port, hotels. Mercedes V-Class & EQE 300 Electric. 24/7.",
  alternates: { canonical: "https://www.elitebcn.info" },
  keywords: ["barcelona airport transfer", "barcelona private transfer", "bcn el prat transfer", "luxury chauffeur barcelona", "mercedes v class barcelona"],
  openGraph: {
    ...SHARED_OG,
    title: "Élite BCN | Barcelona Airport Transfers — From €50",
    description: "Barcelona's #1 luxury private transfer. Fixed prices from €50, no surge pricing. BCN El Prat T1/T2. Mercedes V-Class & EQE 300 Electric. Book 24/7.",
    url: "https://www.elitebcn.info",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
};

export default async function HomePage() {
  const routes = await getPublicRoutes();

  return (
    <>
      <ScrollReset />
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <FleetSection />
        <PricingSection routes={routes} />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
