import type { Metadata } from "next";
import DestinationTemplate, { type DestinationSpec } from "@/components/transfers/DestinationTemplate";
import { SHARED_OG, BASE_URL } from "@/lib/seo";

const D: DestinationSpec = {
  slug: "salou",
  name: "Salou",
  zone: "salou",
  areaServed: "Salou, Costa Daurada, Tarragona",
  distanceKm: 100,
  durationText: "1 hr 10 min",
  intro:
    "Private transfer from Barcelona or El Prat Airport to Salou and PortAventura. Fixed price per vehicle, space for family luggage, door to door.",
  about: [
    "Salou is the main resort on the Costa Daurada, about 100 kilometres southwest of Barcelona, and the closest town to PortAventura World — Spain's largest theme park resort, which sits about ten minutes inland.",
    "The coast here is the reason it developed: long, wide beaches of fine golden sand shelving very gently into the sea, which is why the Costa Daurada has always been popular with families. Platja de Llevant is the main beach, backed by a palm-lined promenade; Platja de Ponent is quieter, and the small coves toward Cap Salou are quieter again.",
    "Beyond the beach and the theme park, Salou is well placed for the rest of the province. Tarragona and its Roman monuments are twenty minutes north, the fishing port and restaurants of Cambrils are ten minutes south, and the Priorat and Montsant wine regions are within an hour inland.",
  ],
  highlights: ["Platja de Llevant", "PortAventura World", "Cap Salou coves", "Tarragona 20 min away"],
  faqs: [
    {
      q: "How long is the transfer from Barcelona Airport to Salou?",
      a: "Salou is approximately 100 km from El Prat Airport and the journey takes around 1 hour 10 minutes via the AP-7 and A-7. From Barcelona city centre the distance and time are similar.",
    },
    {
      q: "Can you drop us directly at PortAventura?",
      a: "Yes. We drop at the park gates, at any of the PortAventura resort hotels, or at your accommodation in Salou — whichever you prefer. Just give us the exact address when booking. Return pickups from the park at closing time are also straightforward to arrange in advance.",
    },
    {
      q: "Do you have vehicles with space for family luggage?",
      a: "Yes. The Mercedes Vito takes up to 8 passengers and the V-Class up to 7 with generous boot space, and the Sprinter minibus handles groups of up to 16. If you are travelling with pushchairs, large cases or sports equipment, tell us when booking and we will assign the right vehicle. Child seats are provided free on request.",
    },
    {
      q: "Is a transfer better than the train to Salou?",
      a: "The train from Barcelona Sants to Salou or PortAventura takes around 75 to 90 minutes plus the time to reach the station, and involves moving luggage on and off. For a family arriving at the airport it is generally simpler and quicker to be driven directly to the door, and the fixed price covers the whole vehicle rather than charging per person.",
    },
  ],
  nearby: [
    { name: "PortAventura World", href: "/transfers/port-aventura", blurb: "Theme park and Ferrari Land, ten minutes inland" },
    { name: "Tarragona",          href: "/transfers/tarragona",     blurb: "Roman amphitheatre and UNESCO old town" },
    { name: "Costa Dorada",       href: "/transfers/costa-dorada",  blurb: "Cambrils, La Pineda and the wider coast" },
  ],
};

export const metadata: Metadata = {
  title: "Barcelona to Salou Transfer — PortAventura | Élite BCN",
  description:
    "Private transfer from Barcelona Airport to Salou and PortAventura. Fixed price per vehicle, family luggage space, child seats free. Book online.",
  alternates: { canonical: `${BASE_URL}/transfers/salou` },
  keywords: ["barcelona salou transfer", "airport salou transfer", "salou portaventura transfer", "salou private transfer", "barcelona to salou taxi"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona to Salou Transfer — PortAventura | Fixed Price",
    description: "Private transfer from Barcelona Airport to Salou and PortAventura. Fixed price, family vehicles, child seats free.",
    url: `${BASE_URL}/transfers/salou`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Élite BCN — Barcelona to Salou Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona to Salou Transfer — PortAventura | Élite BCN",
    description: "Private transfer from Barcelona Airport to Salou and PortAventura. Fixed price, family vehicles.",
    images: ["/opengraph-image"],
  },
};

export default function SalouTransferPage() {
  return <DestinationTemplate d={D} />;
}
