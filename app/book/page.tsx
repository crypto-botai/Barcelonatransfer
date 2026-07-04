import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import BookFormClient from "./BookFormClient";

export const metadata: Metadata = {
  title: { absolute: "Book Your Barcelona Transfer | Élite BCN" },
  description:
    "Book your Barcelona luxury transfer in 60 seconds. Fixed prices from €45. BCN El Prat T1/T2, cruise port, hotels, Sitges & Andorra. Instant confirmation 24/7.",
  alternates: {
    canonical: "https://www.elitebcn.info/book",
  },
  openGraph: {
    title: "Book Your Barcelona Transfer — Fixed Prices from €45",
    description:
      "Instant online booking for luxury private transfers in Barcelona. Fixed prices, no surge pricing. Mercedes V-Class & E-Class.",
    url: "https://www.elitebcn.info/book",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Book Élite BCN Airport Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book Your Barcelona Transfer — Fixed Prices from €45",
    description:
      "Instant online booking for luxury private transfers in Barcelona. Fixed prices, no surge pricing. Mercedes V-Class & E-Class.",
    images: ["/opengraph-image"],
  },
};

export default function BookPage() {
  return (
    <>
      <Navbar />
      <div className="pt-20 pb-6 bg-[#050505]">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h1 className="font-display text-3xl sm:text-4xl text-white mb-2">
            Book Your <span className="text-gold-gradient">Barcelona Transfer</span>
          </h1>
          <p className="text-dark-400 text-sm max-w-lg mx-auto">
            Fixed prices from €45. BCN El Prat T1/T2, cruise port, hotels, Sitges and Andorra. Instant confirmation 24/7.
          </p>
        </div>
      </div>
      <Suspense>
        <BookFormClient />
      </Suspense>
    </>
  );
}
