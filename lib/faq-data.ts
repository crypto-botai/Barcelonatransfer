import { ladderFor } from "@/lib/destination-pricing";

/**
 * Fares quoted in the FAQ are read from the route table, never typed.
 *
 * Every stale price this site has carried began as a correct number written by
 * hand. The €25 additional-waiting charge below stays a literal because it is a
 * contractual fee, not a route, and has nothing to read from.
 */
const eco = (zone: string, origin: "airport" | "barcelona_city" = "airport") =>
  ladderFor(zone, origin)?.economy ?? 0;
const col = (zone: string, key: "minivan" | "vclass", origin: "airport" | "barcelona_city" = "airport") =>
  ladderFor(zone, origin)?.[key] ?? 0;

export const FAQ_GROUPS = [
  {
    group: "Booking & Reservations",
    items: [
      { q: "How do I book a transfer?", a: "You can book instantly online via our booking page — select your service type, enter pick-up and drop-off locations, choose your vehicle, and confirm. You'll receive an email confirmation immediately. You can also book via WhatsApp or phone." },
      // Stated to match what the booking system actually does. This read "at
      // least 24 hours... last-minute bookings may be accommodated" and never
      // mentioned the surcharge, while lib/pricing.ts has charged
      // LAST_MINUTE_SURCHARGE_RATE on anything inside LAST_MINUTE_HOURS the
      // whole time — so a customer booking three hours ahead was told nothing
      // and then charged 15% more. /book's own FAQ had the correct figures;
      // this page contradicted it.
      { q: "How far in advance should I book?", a: "Book at least 4 hours before pickup to avoid the last-minute surcharge: bookings made inside 4 hours carry 15%, and we cannot accept a booking with less than 1 hour's notice. For peak periods, weekends or big events in Barcelona, 48–72 hours ahead is wiser — that is about availability rather than price." },
      { q: "Can I book for someone else?", a: "Absolutely. When booking you can enter the passenger's name, phone, and email separately. The driver will be briefed with the passenger's details and will greet them by name." },
      { q: "What is your cancellation policy?", a: "The free-cancellation window depends on the journey, because the further the car travels the earlier a chauffeur is committed to it. City journeys, including the airport and the cruise port: free more than 24 hours before pickup. Journeys outside the city, such as the Costa Brava, Costa Daurada, Girona, Tarragona or Andorra: free more than 48 hours before. Minibus and group bookings: free more than 72 hours before. Cancel inside that window and the fare is not refunded, and a no-show is charged in full." },
      { q: "What if my flight is cancelled at the last minute?", a: "Message us on WhatsApp with proof of the cancellation, or of whatever else has gone wrong, and we will look at it case by case and decide whether to refund. That is a goodwill decision rather than an entitlement, so if your plans are uncertain the cancellation protection add-on is the safer option. A delayed flight is a different matter entirely: it is never a cancellation, we track it and move your pickup to the new landing time at no charge." },
      { q: "What is cancellation protection?", a: "An optional add-on at the checkout, priced at 20% of the fare. It holds your booking until 2 hours before pickup: cancel any time up to then, for any reason, and the fare is refunded in full. Inside the final 2 hours the fare is not refunded, with or without it. The protection fee itself is never refunded, in any circumstance, because it is what pays for holding the slot." },
      { q: "Can I pay a deposit instead of the full fare?", a: "Yes. At the checkout choose \"Pay 30% now\": the deposit holds the car and the remaining 70% is paid to your chauffeur at the end of the journey, in cash or by card. Your confirmation shows both amounts." },
      { q: "Can I modify my booking after confirmation?", a: "Yes — contact us by WhatsApp or email as soon as possible with the changes. We'll do our best to accommodate modifications to date, time, or destination. Changes are subject to availability." },
    ],
  },
  {
    group: "Airport Transfers",
    items: [
      { q: "Do you track my flight for delays?", a: "Yes. We monitor your flight in real time using your flight number. If your flight is delayed, your driver will adjust their arrival time automatically — you will never be charged for flight delays." },
      // This said the driver waits in the arrivals hall with a name board —
      // which is the €5 Meet & Greet extra, as the Meet & Greet answer further
      // down this same file correctly explains. The two contradicted each
      // other, and the one a customer reads first was the one that would send
      // them to the wrong place: waiting inside arrivals for a driver who is
      // parked outside.
      { q: "Where will the driver meet me at the airport?", a: "At the designated meeting point just outside your terminal at El Prat, next to the taxi rank where reserved VTC cars are allowed to wait. Your chauffeur calls you shortly before you land. If you would rather be met inside the arrivals hall with a name board and helped with your bags from baggage reclaim, add Meet & Greet for €5 when you book. Either way, airport pickups include 60 minutes of free waiting from your actual landing time." },
      { q: "How much free waiting time do I get at the airport?", a: "Airport pickups include 60 minutes of complimentary waiting, counted from the actual landing time. Every other pickup — a city address, the cruise port, Sants or another station — includes 15 minutes. After that, waiting is charged at €25 per 30 minutes." },
      { q: "Do you cover Girona Airport?", a: `Yes. We provide transfers to and from Girona–Costa Brava Airport (GRO). Fixed price from Barcelona El Prat Airport is €${eco('girona_airport')} for an Economy sedan. From Barcelona city, the price starts at €${eco('girona_airport', 'barcelona_city')}. Booking in advance is recommended.` },
      { q: "Do you serve all Costa Brava and Costa Daurada resorts?", a: `Yes. We cover all major resorts with fixed prices from Barcelona Airport: Lloret de Mar from €${eco('lloret')}, Tossa de Mar from €${eco('tossa')}, Salou from €${eco('salou')}, PortAventura from €${eco('portaventura')}, Cambrils from €${eco('cambrils')}, Sitges from €${eco('sitges')}. All routes are fixed-price per vehicle, excluding VAT and tolls.` },
    ],
  },
  {
    group: "Vehicles & Fleet",
    items: [
      { q: "What vehicles do you offer?", a: "Our fleet includes: Toyota Corolla/Camry (economy/business sedan, up to 4 pax), Tesla Model 3 (electric VIP), Mercedes EQE 300 Electric (executive sedan), Mercedes Vito (executive minivan, up to 7 pax), Mercedes V-Class (luxury 7-seat MPV), and Mercedes Sprinter (group minibus, up to 16 pax)." },
      { q: "Are the vehicles clean and well-maintained?", a: "All vehicles are professionally cleaned before every trip and serviced on schedule. If anything about the car is not right when it arrives, tell the driver or call us and we will deal with it." },
      { q: "Can I request a specific vehicle model?", a: "We'll do our best to accommodate specific model requests. Please add a note in the Special Requests field when booking, or contact us directly to confirm availability." },
      { q: "Do your vehicles have WiFi?", a: "Most of them. WiFi is listed on five of the seven cars in the fleet — the exceptions are the V-Class and the Sprinter. Each vehicle page lists exactly what that car carries, so check there before booking if it matters to you." },
    ],
  },
  {
    group: "Pricing & Payment",
    items: [
      { q: "Are your prices fixed or do they use surge pricing?", a: "All our prices are fixed per vehicle. We never apply surge pricing, peak-hour multipliers, or hidden fees. Note that quoted prices exclude VAT and tolls — see the questions below for details." },
      { q: "How much is a transfer within Barcelona city?", a: `A point-to-point transfer inside Barcelona city is charged at the same fixed rate as an airport transfer: from €${eco('barcelona_city')} for an Economy sedan (1–3 passengers), €${col('barcelona_city', 'minivan')} for a Minivan (up to 8) and €${col('barcelona_city', 'vclass')} for a V-Class. That is the same price whether you travel airport to city, city to airport, or between two addresses within the city. Prices exclude VAT and tolls.` },
      { q: "Is VAT included in the price?", a: "No. Quoted prices exclude VAT. If you require an invoice — for a company, business travel, or expense claims — 10% Spanish VAT is added to the fare. If you do not need an invoice, you simply pay the quoted price. Let us know when booking so we can issue the invoice correctly." },
      { q: "Are motorway tolls included?", a: "No. Tolls are not included in the quoted price and are charged separately where the route uses a toll motorway. Longer routes — Costa Brava, Costa Daurada, Tarragona, Girona, Andorra and similar — normally involve tolls; short city and airport transfers usually do not. Your driver can confirm the exact toll amount for your route." },
      { q: "What is included in the price?", a: "The quoted price includes the professional chauffeur, the vehicle, fuel, parking and standard waiting time. Airport transfers also include flight tracking and 60 minutes of free waiting. VAT and tolls are NOT included — see the two questions above." },
      { q: "What payment methods do you accept?", a: "We accept all major credit and debit cards (Visa, Mastercard, Amex) through our secure online payment system. You can also pay via bank transfer or cash on request. Online payments are processed securely." },
      { q: "Is there a night surcharge?", a: "Fixed-price transfers have no night surcharge — the price you see is always fixed. A 20% night surcharge applies only to hourly chauffeur hire (22:00–06:00)." },
    ],
  },
  {
    group: "Extras & Add-ons",
    items: [
      { q: "Do I need a child seat in Spain?", a: "Yes. Spanish law requires every child of 135 cm or under to travel in an approved child restraint system. The exemption that applies to metered taxis on urban journeys does not extend to licensed VTC vehicles such as ours, so a seat is required on every journey we make. Tell us when you book: a car that turns up without the right seat cannot legally carry your child." },
      { q: "Can I add child seats to my booking?", a: "Yes. Baby Seats (0–13 kg), Child Seats (9–18 kg), and Booster Seats (15–36 kg) are €5 per seat, and we carry one baby seat and one booster seat on request. Ask for them under Special Requests when booking and give your child's height and weight, so the right seat is fitted before the car is dispatched." },
      { q: "Can I bring my pet?", a: "Pets are welcome with prior notice. Tell us under Special Requests when booking and we will confirm the arrangement and any cleaning charge before you travel. Please ensure your pet is in a carrier or on a lead. Our drivers are pet-friendly." },
      { q: "What is the Meet & Greet service?", a: "It is an optional extra, €5. Your chauffeur meets you in the arrivals hall with your name on a board and helps with your bags to the car. Without it, your chauffeur waits at the designated meeting point outside, next to the taxi rank where reserved VTC cars may park. Either way, airport pickups include 60 minutes of free waiting from your actual landing time." },
      { q: "How does Meet & Greet actually work when I land?", a: "An international arrival takes as long as it takes: passport control and baggage reclaim can run to an hour, sometimes two, and no chauffeur can stand inside for all of it. So your chauffeur waits outside and follows your flight. When you reach baggage reclaim, message them: \"please come to the meeting point\". That message is what starts them moving, and they need about ten minutes to walk in from the car park. In Terminal 1 and Terminal 2B the meeting point is in the arrivals hall by the Como restaurant; in Terminal 2A your chauffeur waits directly in front of the arrivals door." },
      { q: "What if I reach arrivals before my chauffeur?", a: "Give them the ten minutes from your message. If they still have not appeared, ask us for the Meet & Greet fee back and we will refund it. The rest of the transfer goes ahead as normal." },
      { q: "The walk from Terminal 2 parking is long. Is there a shorter option?", a: "Yes. When you are ready, ask your chauffeur to come to the express car park instead of the main one. They park there, walk into the hall with your name board, and the walk back to the car is much shorter. Airport parking is expensive and keeping it short is part of how our fares stay where they are, so we do not do it by default, but ask and it is arranged." },
      { q: "What happens if our luggage does not fit?", a: "Book the vehicle for the luggage rather than only for the number of passengers; every vehicle page lists how many large cases it takes, and one size up is usually right for a family holiday. If the luggage genuinely does not fit on the day we can arrange a second vehicle, charged separately. Luggage travels in the boot and not in the passenger compartment: loose cases in the cabin are dangerous in a sudden stop." },
      { q: "Can I load my own luggage?", a: "Your chauffeur does it, and we would rather they did. If you insist on handling it yourself, any damage or loss is not covered by our insurance, and neither is injury in the event of an accident caused by it." },
      { q: "Can the driver make multiple stops?", a: "Yes. Add the stops under Special Requests when booking and we will confirm the price before you travel, as it depends on the detour. This is ideal for hotel-to-meeting-to-restaurant itineraries or multi-destination tours." },
    ],
  },
  {
    group: "Drivers & Safety",
    items: [
      { q: "Are your drivers licensed and insured?", a: "All our chauffeurs hold valid VTC (Vehículo de Turismo con Conductor) licences issued by the Barcelona Metropolitan Authority. All vehicles carry full professional passenger liability insurance." },
      { q: "Do you provide English-speaking drivers?", a: "Yes. All our drivers speak English and Spanish. Many also speak French, Italian, German, or Arabic. If you have a specific language requirement, please note it when booking." },
      { q: "Is it safe to book online?", a: "Absolutely. Our website uses industry-standard SSL encryption. Payment is processed by SumUp, a regulated European payment provider. We never store your card details." },
      { q: "What if my driver doesn't arrive?", a: "This is extremely rare, but in the unlikely event of an issue, our operations team is available 24/7 by phone and WhatsApp. We will resolve the situation or arrange an alternative vehicle as quickly as possible." },
    ],
  },
] as const;

export type FaqGroup = (typeof FAQ_GROUPS)[number];
export type FaqItem  = FaqGroup["items"][number];
