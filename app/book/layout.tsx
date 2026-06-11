import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book Your Barcelona Transfer — Instant Pricing & Confirmation",
  description:
    "Book your private luxury transfer in Barcelona in 60 seconds. Fixed prices from €45. BCN El Prat T1/T2, cruise port, hotels, Sitges, Andorra and beyond. Instant confirmation 24/7.",
  alternates: { canonical: "https://www.elitebcn.info/book" },
  openGraph: {
    title: "Book Your Barcelona Transfer — Fixed Prices from €45",
    description: "Instant online booking for luxury private transfers in Barcelona. Fixed prices, no surge pricing. Mercedes, Tesla, BMW.",
    url: "https://www.elitebcn.info/book",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Book Élite BCN Airport Transfer" }],
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
