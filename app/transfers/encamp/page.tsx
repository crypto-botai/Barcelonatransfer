import type { Metadata } from "next";
import RouteLandingPage from "@/components/transfers/RouteLanding";
import { routeLanding } from "@/lib/route-landings";
import { SHARED_OG } from "@/lib/seo";

// Layout and copy live in lib/route-landings.ts so the commercial route pages
// cannot drift apart. See the note at the top of that file.
const data = routeLanding("encamp")!;

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

export default function EncampTransferPage() {
  return <RouteLandingPage data={data} />;
}
