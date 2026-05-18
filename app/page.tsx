import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import HeroSection from "@/components/sections/HeroSection";
import ServicesSection from "@/components/sections/ServicesSection";
import FleetSection from "@/components/sections/FleetSection";
import StatsSection from "@/components/sections/StatsSection";
import PricingSection from "@/components/sections/PricingSection";
import TestimonialsSection from "@/components/sections/TestimonialsSection";

export const metadata: Metadata = {
  title: "Élite BCN | Luxury Private Transfers Barcelona",
  description:
    "Barcelona's premier luxury chauffeur service. Airport transfers, VIP travel, Mercedes S-Class, Tesla Model S. Instant online booking with fixed prices.",
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
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
