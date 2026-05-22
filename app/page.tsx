import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import FleetSection from "@/components/sections/FleetSection";
import PricingSection from "@/components/sections/PricingSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";

export const metadata: Metadata = {
  title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices from €45",
  description:
    "Barcelona's #1 luxury private transfer. Fixed prices from €45 — no surge pricing, ever. BCN El Prat T1/T2, cruise port & hotels. Mercedes, Tesla, BMW. Book instantly 24/7.",
  alternates: { canonical: "https://www.elitebcn.info" },
  openGraph: {
    title: "Élite BCN | Luxury Airport Transfers Barcelona — Fixed Prices from €45",
    description: "Barcelona's #1 luxury private transfer. Fixed prices from €45 — no surge pricing, ever. Mercedes, Tesla, BMW. Book 24/7.",
    url: "https://www.elitebcn.info",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Luxury Private Transfer Barcelona Airport" }],
  },
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <FleetSection />
        <PricingSection />
        <TestimonialsSection />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
