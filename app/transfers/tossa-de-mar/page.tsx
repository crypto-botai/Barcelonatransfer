import type { Metadata } from "next";
import DestinationTemplate, { type DestinationSpec } from "@/components/transfers/DestinationTemplate";
import { SHARED_OG, BASE_URL } from "@/lib/seo";

const D: DestinationSpec = {
  slug: "tossa-de-mar",
  name: "Tossa de Mar",
  zone: "tossa",
  areaServed: "Tossa de Mar, Costa Brava, Catalonia",
  distanceKm: 90,
  durationText: "1 hr 15 min",
  guideHref: "/blog/tossa-de-mar-guide",
  intro:
    "Private transfer from Barcelona or El Prat Airport to Tossa de Mar, the only walled medieval town on the Catalan coast. Fixed price, door to door.",
  about: [
    "Tossa de Mar sits about 90 kilometres northeast of Barcelona on the southern Costa Brava, and it is the only town on the entire Catalan coast that still has its medieval walls standing. The Vila Vella — three surviving towers and most of the twelfth-century curtain wall — occupies a headland that drops straight into the sea above the main beach.",
    "Below the walls, Platja Gran is a 400-metre arc of golden sand. Either side of the headland the coastline breaks into small rocky coves: Es Codolar just around the point, Mar Menuda to the north with the best snorkelling in the area, and Cala Bona and Cala Pola a short drive up the coast.",
    "The town also has a place in art history. A colony of European painters settled here in the 1930s — Marc Chagall called it a blue paradise — and the municipal museum, the first museum of contemporary art in Catalonia, still holds work from that period.",
  ],
  highlights: ["Vila Vella walled town", "Platja Gran", "Mar Menuda snorkelling", "Coastal path to Sant Feliu"],
  faqs: [
    {
      q: "How long is the transfer from Barcelona to Tossa de Mar?",
      a: "Tossa is approximately 90 km from Barcelona city and around 100 km from El Prat Airport. The journey takes roughly 1 hour 15 minutes using the AP-7 and C-32. There is no railway station in Tossa, so road transport is the only direct option.",
    },
    {
      q: "Can we take the scenic coast road?",
      a: "Yes, and we recommend it. The GI-682 from Lloret de Mar to Tossa is a genuine corniche road hanging above the sea, and it is one of the best drives in Catalonia. It adds around twenty minutes to the journey and costs nothing extra — just tell your driver when you are collected.",
    },
    {
      q: "Is parking difficult in Tossa de Mar?",
      a: "Yes, particularly in July and August. The town sits in a bowl with limited access roads and the car parks near the beach fill early. Being dropped at your accommodation and collected later avoids the problem entirely, which is why a large share of our summer bookings on this route are day trips.",
    },
    {
      q: "Is Tossa de Mar open in winter?",
      a: "Partly. A significant number of hotels and restaurants close between roughly November and March. The walled town, the beaches and the coastal paths remain open year round and the coast in winter is dramatic, but if you are visiting out of season check your accommodation and restaurant options in advance.",
    },
  ],
  nearby: [
    { name: "Lloret de Mar", href: "/transfers/lloret-de-mar", blurb: "Twenty minutes along the coast road" },
    { name: "Costa Brava",   href: "/transfers/costa-brava",   blurb: "Blanes, Platja d'Aro and the wider coast" },
    { name: "Girona",        href: "/transfers/girona",        blurb: "Medieval city and airport, inland from the coast" },
  ],
};

export const metadata: Metadata = {
  title: "Barcelona to Tossa de Mar Transfer | Elite BCN",
  description:
    "Private transfer from Barcelona to Tossa de Mar on the Costa Brava. Fixed price per vehicle, 1h 15min, meet & greet €5. Book online.",
  alternates: { canonical: `${BASE_URL}/transfers/tossa-de-mar` },
  keywords: ["barcelona tossa de mar transfer", "tossa de mar taxi", "tossa de mar private transfer", "airport tossa de mar"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona to Tossa de Mar Transfer | Fixed Price",
    description: "Private transfer from Barcelona to Tossa de Mar. Fixed price, meet & greet, scenic coast road on request.",
    url: `${BASE_URL}/transfers/tossa-de-mar`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona to Tossa de Mar Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona to Tossa de Mar Transfer | Elite BCN",
    description: "Private transfer from Barcelona to Tossa de Mar. Fixed price, meet & greet, no surge pricing.",
    images: ["/opengraph-image"],
  },
};

export default function TossaDeMarTransferPage() {
  return <DestinationTemplate d={D} />;
}
