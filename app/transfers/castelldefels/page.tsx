import type { Metadata } from "next";
import DestinationTemplate, { type DestinationSpec } from "@/components/transfers/DestinationTemplate";
import { SHARED_OG, BASE_URL } from "@/lib/seo";

const D: DestinationSpec = {
  slug: "castelldefels",
  name: "Castelldefels",
  zone: "castelldefels",
  areaServed: "Castelldefels, Baix Llobregat, Barcelona",
  distanceKm: 20,
  durationText: "22 min",
  intro:
    "Private transfer from El Prat Airport to Castelldefels — the closest beach town to the airport, just 20 km and around 22 minutes away.",
  about: [
    "Castelldefels sits 20 kilometres southwest of Barcelona and, unusually, is closer to El Prat Airport than the city centre is. That makes it one of the quickest airport-to-beach journeys anywhere on this coast: around 22 minutes door to door.",
    "The draw is five kilometres of wide, flat sand with a very gentle shelf into the water, which makes it particularly good for families with young children. The beach is backed by a long promenade of restaurants and beach bars, and it rarely feels as compressed as Barcelona's own city beaches.",
    "Behind the town, the medieval Castell de Castelldefels sits on a wooded hill with views along the coast, and the Garraf Natural Park begins immediately to the southwest. The town is also home to a technology and research campus, which means a steady flow of business visitors alongside the beach traffic.",
  ],
  highlights: ["5 km of beach", "22 min from the airport", "Medieval castle", "Garraf Natural Park"],
  faqs: [
    {
      q: "How far is Castelldefels from Barcelona Airport?",
      a: "Castelldefels is approximately 20 km from El Prat Airport — closer than central Barcelona. A private transfer takes about 22 minutes, making it one of the fastest airport-to-destination journeys in the region.",
    },
    {
      q: "Is Castelldefels good for families?",
      a: "Very. The beach is wide and flat with a gradual shelf into the sea, so the water stays shallow a long way out. The promenade behind it has plenty of restaurants and facilities, and the short transfer from the airport means young children are not stuck in a car after a flight.",
    },
    {
      q: "Can you transfer between Castelldefels and central Barcelona?",
      a: "Yes. Point-to-point transfers between Castelldefels and any Barcelona city address are available at a fixed price. The journey takes roughly 30 to 40 minutes depending on traffic and where in the city you are going.",
    },
    {
      q: "Is there a train to Castelldefels?",
      a: "Yes, the RENFE R2 line runs from Barcelona and takes around 25 to 30 minutes, but note that Castelldefels station is in the town centre, roughly 2 km from the beach — a further bus ride or walk. There is a separate Castelldefels Platja station closer to the sand, served by fewer trains. With luggage, a direct transfer avoids both connections.",
    },
  ],
  nearby: [
    { name: "Sitges",       href: "/transfers/sitges",       blurb: "Fifteen minutes further along the Garraf coast" },
    { name: "Costa Dorada", href: "/transfers/costa-dorada", blurb: "Cubelles, Calafell and the coast south" },
    { name: "Cruise Port",  href: "/transfers/cruise-port",  blurb: "Barcelona cruise terminals, 25 minutes away" },
  ],
};

export const metadata: Metadata = {
  title: { absolute: "Barcelona Airport to Castelldefels Transfer" },
  description:
    "Private transfer from El Prat Airport to Castelldefels in 22 minutes. Fixed price per vehicle. Child seats and meet & greet €5 each.",
  alternates: { canonical: `${BASE_URL}/transfers/castelldefels` },
  keywords: ["castelldefels transfer", "airport castelldefels taxi", "barcelona castelldefels transfer", "castelldefels beach transfer", "el prat castelldefels"],
  openGraph: {
    ...SHARED_OG,
    title: "Barcelona Airport to Castelldefels Transfer | Fixed Price",
    description: "Private transfer from El Prat Airport to Castelldefels in 22 minutes. Fixed price, child seats €5 each.",
    url: `${BASE_URL}/transfers/castelldefels`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Airport to Castelldefels Private Transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Airport to Castelldefels Transfer | Elite BCN",
    description: "Private transfer from El Prat Airport to Castelldefels in 22 minutes. Fixed price per vehicle.",
    images: ["/opengraph-image"],
  },
};

export default function CastelldefelsTransferPage() {
  return <DestinationTemplate d={D} />;
}
