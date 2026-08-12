import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Transfer FAQ — Common Questions | Elite BCN" },
  description:
    "Answers to common questions about Barcelona airport transfers, pricing, booking, cancellation, fleet vehicles and chauffeur services. Book from €50.",
  alternates: { canonical: "https://www.elitebcn.info/faq" },
  openGraph: {
    title: "FAQ — Barcelona Airport Transfers | Elite BCN",
    description: "Everything you need to know about booking a luxury private transfer in Barcelona. Prices, vehicles, cancellation policy and more.",
    url: "https://www.elitebcn.info/faq",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN FAQ" }],
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
