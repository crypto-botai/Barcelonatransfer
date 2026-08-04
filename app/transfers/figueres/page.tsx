import type { Metadata } from "next";
import DestinationTemplate, { type DestinationSpec } from "@/components/transfers/DestinationTemplate";
import { SHARED_OG, BASE_URL } from "@/lib/seo";

const D: DestinationSpec = {
  slug: "figueres",
  name: "Figueres",
  zone: "figueres",
  areaServed: "Figueres, Alt Empordà, Catalonia",
  distanceKm: 140,
  durationText: "1 hr 40 min",
  guideHref: "/blog/figueres-dali-theatre-museum",
  intro:
    "Private transfer from Barcelona or El Prat Airport to Figueres, home of the Dalí Theatre-Museum. Fixed price, door to door, no surge pricing.",
  about: [
    "Figueres is the capital of the Alt Empordà, about 140 kilometres north of Barcelona and close to the French border. For most visitors it means one thing: the Dalí Theatre-Museum, built by Salvador Dalí inside the shell of the town theatre where he held his first exhibition, and where he is now buried beneath the floor.",
    "The museum is the most visited in Catalonia after the Picasso Museum, and it is unlike any conventional gallery — Dalí described the whole building as a single surrealist object, with giant eggs on the roof, a geodesic dome over the old auditorium, and a courtyard containing a Cadillac that rains on the inside.",
    "The town around it repays a little time too. The Castell de Sant Ferran on the hill above is one of the largest bastioned fortresses in Europe, with a perimeter of over three kilometres, and it is rarely busy. The Rambla and the covered market are the centre of ordinary Figueres life, and the Empordà region around the town produces some of the best food and wine in Catalonia.",
  ],
  highlights: ["Dalí Theatre-Museum", "Castell de Sant Ferran", "Toy Museum of Catalonia", "Empordà wine country"],
  faqs: [
    {
      q: "How long is the transfer from Barcelona to Figueres?",
      a: "Figueres is approximately 140 km from Barcelona and around 150 km from El Prat Airport. The journey takes roughly 1 hour 40 minutes via the AP-7 motorway. Your driver monitors traffic and adjusts the route where needed.",
    },
    {
      q: "Can you combine Figueres with Cadaqués in one day?",
      a: "Yes, and it is the most popular way to see the region. Figueres and Cadaqués are about an hour apart on the same route north, so a transfer with waiting time lets you visit the Theatre-Museum in the morning and Dalí's house at Portlligat in the afternoon. Tell us when booking and we will build the waiting time into the quote.",
    },
    {
      q: "Do I need to book the Dalí museum in advance?",
      a: "Yes. Entry is by timed slot and it sells out well ahead in summer. Book your museum ticket directly with the Fundació Gala-Salvador Dalí before arranging your transfer time, then give us the slot and we will plan the pickup around it. Note the museum is usually closed on Mondays outside high season.",
    },
    {
      q: "Is it cheaper to take the train to Figueres?",
      a: "For a solo traveller, generally yes — the high-speed train from Barcelona Sants reaches Figueres-Vilafant in around 55 minutes. Bear in mind that station is a 15-minute walk from the museum, and you need to reach Sants first. For groups of three or more, or anyone arriving at the airport with luggage, a private transfer is usually the more practical option door to door.",
    },
  ],
  nearby: [
    { name: "Cadaqués",    href: "/transfers/cadaques",    blurb: "Dalí's house at Portlligat, one hour further on" },
    { name: "Girona",      href: "/transfers/girona",      blurb: "Medieval old town, on the route back to Barcelona" },
    { name: "Costa Brava", href: "/transfers/costa-brava", blurb: "Roses, Empuriabrava and the northern coast" },
  ],
};

export const metadata: Metadata = {
  title: "Barcelona to Figueres Transfer — Dalí Museum | Élite BCN",
  description:
    "Private transfer from Barcelona to Figueres and the Dalí Theatre-Museum. Fixed price per vehicle, 1h 40min, meet & greet included. Book online.",
  alternates: { canonical: `${BASE_URL}/transfers/figueres` },
  keywords: ["barcelona figueres transfer", "dali museum transfer", "figueres private transfer", "barcelona to figueres taxi", "figueres airport transfer"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona to Figueres Transfer — Dalí Museum | Fixed Price",
    description: "Private transfer from Barcelona to Figueres and the Dalí Theatre-Museum. Fixed price, meet & greet, no surge pricing.",
    url: `${BASE_URL}/transfers/figueres`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona to Figueres Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona to Figueres Transfer — Dalí Museum | Élite BCN",
    description: "Private transfer from Barcelona to Figueres and the Dalí Theatre-Museum. Fixed price, meet & greet.",
    images: ["/opengraph-image"],
  },
};

export default function FigueresTransferPage() {
  return <DestinationTemplate d={D} />;
}
