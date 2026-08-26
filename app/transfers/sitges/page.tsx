import type { Metadata } from "next";
import RouteLandingPage from "@/components/transfers/RouteLanding";
import { routeLanding } from "@/lib/route-landings";
import { SHARED_OG } from "@/lib/seo";

// Rebuilt 26 Aug from Search Console data: this page drew real impressions and
// zero clicks at position 56-62, and the queries reaching it were largely
// comparative — people pricing the train, the bus and a taxi before booking.
// Layout and copy live in lib/route-landings.ts.
const data = routeLanding("sitges")!;

export const metadata: Metadata = {
  title: { absolute: data.title },
  description: data.description,
  alternates: { canonical: data.url },
  keywords: data.keywords,
  openGraph: {
    ...SHARED_OG,
    title: data.title,
    description: data.description,
    url: data.url,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `Elite BCN — ${data.h1}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: data.title,
    description: data.description,
    images: ["/opengraph-image"],
  },
};

export default function SitgesTransferPage() {
  return <RouteLandingPage data={data} />;
}
