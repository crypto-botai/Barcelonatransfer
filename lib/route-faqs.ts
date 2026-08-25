import type { RouteFaqSpec } from "@/components/transfers/RouteFaqs";

/**
 * Per-destination questions for the five hand-built route pages.
 *
 * Only the things that are true of this destination and not of the others —
 * a generic set repeated five times would be filler with a word count. Fares
 * are never written here; RouteFaqs reads them from the price table.
 *
 * Distances and durations are the figures each page already publishes in its
 * own hero, so this section cannot disagree with the page it sits on.
 */
export const ROUTE_FAQ_SPECS: Record<string, RouteFaqSpec> = {
  sitges: {
    zone: "sitges",
    name: "Sitges",
    distance: "35 km",
    duration: "35 minutes",
    faqs: [
      {
        q: "Will the driver take me to my hotel or apartment?",
        a: "Yes. The fare is door to door to any address in Sitges, so a seafront hotel, an apartment in the old town or a villa in Vallpineda all cost the same. Give the full address when you book — the streets behind the front are narrow and one-way in places, and the exact number saves circling.",
      },
      {
        q: "Is the train from the airport a better option?",
        a: "If you are one or two people travelling light and landing in daylight, honestly yes — it is cheap and reasonably quick. It stops being the better option with two suitcases, a late flight, or accommodation uphill from the station, because the Rodalies line requires a change and the walk at the far end is the part nobody plans for.",
      },
      {
        q: "Can you collect us during Carnival or Pride week?",
        a: "Yes, and it is worth booking further ahead than usual. Sitges fills completely during both, road access into the centre is restricted on the busiest days, and your driver may need to drop you a short walk from the door. We will tell you if that applies to your address rather than discovering it on the night.",
      },
    ],
    related: [
      { href: "/transfers/vilanova", label: "Vilanova i la Geltrú, the next town along" },
      { href: "/transfers/costa-dorada", label: "the wider Costa Dorada" },
      { href: "/transfers/barcelona-city-centre", label: "central Barcelona" },
    ],
  },

  girona: {
    zone: "girona_airport",
    origin: "barcelona_city",
    name: "Girona",
    distance: "100 km",
    duration: "70 minutes",
    faqs: [
      {
        q: "Do you go to Girona city or Girona airport?",
        a: "Both, and they are priced separately because they are not the same place — the airport sits several kilometres outside the city. Tell us which you need when you book. If you are flying in to Girona and staying in Barcelona, the run is the same fare in the opposite direction.",
      },
      {
        q: "Is this useful for a Ryanair flight from Girona?",
        a: "It is one of the more common reasons people book it. Girona handles a lot of low-cost traffic that is sold as Barcelona, and the coach connection is timed to the airline rather than to you. A fixed transfer means the departure time is yours and does not depend on a bus that leaves when it leaves.",
      },
      {
        q: "Can we stop somewhere on the way?",
        a: "Yes. The road to Girona passes reasonably close to several places people want to see, and a stop can be added for an agreed supplement rather than repricing the whole journey. If you want more than one stop, by-the-hour hire is usually cheaper — tell us the plan and we will say which works out lower.",
      },
    ],
    related: [
      { href: "/transfers/costa-brava", label: "the Costa Brava coast" },
      { href: "/transfers/begur", label: "Begur and Aiguablava" },
      { href: "/transfers/figueres", label: "Figueres" },
    ],
  },

  montserrat: {
    zone: "montserrat",
    name: "Montserrat",
    distance: "50 km",
    duration: "50 minutes",
    faqs: [
      {
        q: "Will the driver wait while we visit?",
        a: "Yes, if you book it that way. Montserrat is a return trip for almost everyone, and a wait-and-return keeps the same car and driver for the journey back rather than leaving you to the last cremallera down. Tell us roughly how long you want and we will quote the wait before you book.",
      },
      {
        q: "How long should we allow at the mountain?",
        a: "Three to four hours suits most visits — the basilica, the viewpoints and lunch. Add time if you plan to take a funicular higher up or walk any of the paths. If you want the full day, by-the-hour hire is usually cheaper than a transfer with a long wait attached.",
      },
      {
        q: "Is a private car better than the train and cable car?",
        a: "For one or two people the rack railway is atmospheric and good value, and we will say so. A private car earns its price with a group, with anyone who finds steps and connections difficult, or when you want to arrive before the coaches do — which is the single biggest difference to how the place feels.",
      },
    ],
    related: [
      { href: "/day-tours", label: "full-day private tours" },
      { href: "/hourly", label: "by-the-hour hire" },
      { href: "/transfers/barcelona-city-centre", label: "central Barcelona" },
    ],
  },

  tarragona: {
    zone: "tarragona",
    name: "Tarragona",
    distance: "90 km",
    duration: "1 hour",
    faqs: [
      {
        q: "Can you collect from the cruise terminal at Tarragona?",
        a: "Yes. Tarragona takes cruise calls as well as Barcelona, and the fare is the same door-to-door price. Give us the ship name and the scheduled arrival when you book so the pickup is timed to the gangway rather than to a guess, and tell us if you are on a shore excursion deadline.",
      },
      {
        q: "Is Tarragona a good base for PortAventura?",
        a: "It is a common combination — the park is a short drive from the city and many families stay in Tarragona rather than at the resort. Both are priced in the same table, so a stay that involves both is straightforward to arrange as separate transfers or as a day with the car.",
      },
      {
        q: "How does this compare with the train?",
        a: "The direct trains are quick and good value if your accommodation is near the station. The catch is that Tarragona's high-speed station is well outside the city, so the connection at the far end is what decides it — with luggage, that transfer often costs enough to close most of the gap.",
      },
    ],
    related: [
      { href: "/transfers/port-aventura", label: "PortAventura World" },
      { href: "/transfers/salou", label: "Salou" },
      { href: "/transfers/costa-dorada", label: "the Costa Dorada" },
    ],
  },

  "port-aventura": {
    zone: "portaventura",
    name: "PortAventura World",
    distance: "95 km",
    duration: "70 minutes",
    faqs: [
      {
        q: "Will you drop us at the hotel or at the park entrance?",
        a: "Wherever you need. The resort hotels, the park gates and the apartments in Salou nearby are all the same fare, because it is a door-to-door price rather than a drop at a single point. Give the hotel name when you book — the resort is large and the entrances are some distance apart.",
      },
      {
        q: "Is a private transfer worth it for a family?",
        a: "This is the route where it most often is. The fare is per vehicle, so two adults and two children pay once rather than four times, and the alternative involves a train plus a shuttle bus with luggage and tired children at the end of a flight. Compare the vehicle price against four tickets before deciding.",
      },
      {
        q: "Can you collect us at the end of a late day at the park?",
        a: "Yes. There is no last departure to run for, which matters here more than on most routes — the park runs late in season and the public connections thin out well before it closes. Book the return when you book the outbound and the car will be waiting at the time you set.",
      },
    ],
    related: [
      { href: "/transfers/salou", label: "Salou" },
      { href: "/transfers/tarragona", label: "Tarragona" },
      { href: "/transfers/costa-dorada", label: "the Costa Dorada" },
    ],
  },
};
