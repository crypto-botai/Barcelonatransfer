// Metadata for the hand-built destination pages under app/transfers/<slug>/page.tsx —
// these are NOT part of data/destinations.json (which only covers the 41 programmatic
// hotel/cruise/event/route pages), so "nearby" lookups in app/transfers/[slug]/page.tsx
// need this list too, or any nearby reference to e.g. "girona" or "sitges" silently
// disappears from the related-destinations grid instead of resolving.
export interface StaticTransferPage {
  slug: string;
  name: string;
  type: "hotel" | "cruise" | "event" | "route";
  distance_km: number;
  prices: { sedan: number };
}

export const STATIC_TRANSFER_PAGES: StaticTransferPage[] = [
  { slug: "sitges",       name: "Sitges",                    type: "route", distance_km: 35,  prices: { sedan: 65 } },
  { slug: "girona",       name: "Girona",                    type: "route", distance_km: 100, prices: { sedan: 110 } },
  { slug: "tarragona",    name: "Tarragona",                 type: "route", distance_km: 90,  prices: { sedan: 95 } },
  { slug: "montserrat",   name: "Montserrat",                type: "route", distance_km: 50,  prices: { sedan: 85 } },
  { slug: "costa-brava",  name: "Costa Brava",               type: "route", distance_km: 130, prices: { sedan: 130 } },
  { slug: "andorra",      name: "Andorra",                   type: "route", distance_km: 210, prices: { sedan: 220 } },
  { slug: "lourdes",      name: "Lourdes",                   type: "route", distance_km: 415, prices: { sedan: 750 } },
  { slug: "cruise-port",  name: "Barcelona Cruise Port",      type: "cruise", distance_km: 10, prices: { sedan: 45 } },
  { slug: "port-aventura", name: "PortAventura World",        type: "event", distance_km: 95,  prices: { sedan: 99 } },
  { slug: "costa-dorada", name: "Costa Dorada",               type: "route", distance_km: 90,  prices: { sedan: 50 } },
  { slug: "lloret-de-mar", name: "Lloret de Mar",             type: "route", distance_km: 75,  prices: { sedan: 145 } },
  { slug: "cadaques",     name: "Cadaqués",                   type: "route", distance_km: 170, prices: { sedan: 240 } },
  { slug: "figueres",     name: "Figueres",                   type: "route", distance_km: 140, prices: { sedan: 155 } },
  { slug: "tossa-de-mar", name: "Tossa de Mar",               type: "route", distance_km: 90,  prices: { sedan: 110 } },
  { slug: "salou",        name: "Salou",                      type: "route", distance_km: 100, prices: { sedan: 150 } },
  { slug: "castelldefels", name: "Castelldefels",             type: "route", distance_km: 20,  prices: { sedan: 50 } },
  // Added 26 Aug with the four commercial route pages. distance_km is the road
  // distance from the airport; prices.sedan is not displayed — the nearby cards
  // resolve the real fare through SLUG_TO_ZONE, which all four are now in.
  { slug: "la-roca-village", name: "La Roca Village",          type: "route", distance_km: 50,  prices: { sedan: 105 } },
  { slug: "sants-station",  name: "Barcelona Sants Station",   type: "route", distance_km: 14,  prices: { sedan: 50 } },
  { slug: "vilanova",       name: "Vilanova i la Geltru",      type: "route", distance_km: 36,  prices: { sedan: 85 } },
  { slug: "begur",          name: "Begur & Aiguablava",        type: "route", distance_km: 146, prices: { sedan: 200 } },
];
