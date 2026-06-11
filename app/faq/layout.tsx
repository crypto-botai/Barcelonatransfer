import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Barcelona Airport Transfer Questions Answered",
  description:
    "Answers to the most common questions about our Barcelona private transfer service. Pricing, vehicles, booking, cancellations, airport pickups, and more.",
  alternates: { canonical: "https://www.elitebcn.info/faq" },
  openGraph: {
    title: "FAQ — Barcelona Airport Transfers | Élite BCN",
    description: "Everything you need to know about booking a luxury private transfer in Barcelona. Prices, vehicles, cancellation policy and more.",
    url: "https://www.elitebcn.info/faq",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN FAQ" }],
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
