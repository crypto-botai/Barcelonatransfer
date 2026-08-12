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
      { q: "How far in advance should I book?", a: "We recommend booking at least 24 hours in advance to guarantee vehicle availability. For peak periods, weekends, or special events in Barcelona, booking 48–72 hours ahead is advisable. Last-minute bookings may be accommodated — contact us directly." },
      { q: "Can I book for someone else?", a: "Absolutely. When booking you can enter the passenger's name, phone, and email separately. The driver will be briefed with the passenger's details and will greet them by name." },
      { q: "Is there a cancellation fee?", a: "Cancellations made more than 24 hours before the scheduled pickup are fully refunded. Cancellations within 24 hours may incur a 50% charge. No-shows are charged in full. Please contact us as early as possible if your plans change." },
      { q: "Can I modify my booking after confirmation?", a: "Yes — contact us by WhatsApp or email as soon as possible with the changes. We'll do our best to accommodate modifications to date, time, or destination. Changes are subject to availability." },
    ],
  },
  {
    group: "Airport Transfers",
    items: [
      { q: "Do you track my flight for delays?", a: "Yes. We monitor your flight in real time using your flight number. If your flight is delayed, your driver will adjust their arrival time automatically — you will never be charged for flight delays." },
      { q: "Where will the driver meet me at the airport?", a: "Your driver will be waiting in the arrivals hall at El Prat Airport (Terminal 1 or Terminal 2) holding a personalised name board. For Meet & Greet bookings, the driver will assist you from the baggage reclaim area." },
      { q: "How much free waiting time do I get at the airport?", a: "Airport pickups include 60 minutes of complimentary waiting, counted from the actual landing time. Every other pickup — a city address, the cruise port, Sants or another station — includes 15 minutes. After that, waiting is charged at €25 per 30 minutes." },
      { q: "Do you cover Girona Airport?", a: `Yes. We provide transfers to and from Girona–Costa Brava Airport (GRO). Fixed price from Barcelona El Prat Airport is €${eco('girona_airport')} for an Economy sedan. From Barcelona city, the price starts at €${eco('girona_airport', 'barcelona_city')}. Booking in advance is recommended.` },
      { q: "Do you serve all Costa Brava and Costa Daurada resorts?", a: `Yes. We cover all major resorts with fixed prices from Barcelona Airport: Lloret de Mar from €${eco('lloret')}, Tossa de Mar from €${eco('tossa')}, Salou from €${eco('salou')}, PortAventura from €${eco('portaventura')}, Cambrils from €${eco('cambrils')}, Sitges from €${eco('sitges')}. All routes are fixed-price per vehicle, excluding VAT and tolls.` },
    ],
  },
  {
    group: "Vehicles & Fleet",
    items: [
      { q: "What vehicles do you offer?", a: "Our fleet includes: Toyota Corolla/Camry (economy/business sedan, up to 4 pax), Tesla Model 3 (electric VIP), Mercedes EQE 300 Electric (executive sedan), Mercedes Vito (executive minivan, up to 7 pax), Mercedes V-Class (luxury 7-seat MPV), and Mercedes Sprinter (group minibus, up to 16 pax). All are under 3 years old." },
      { q: "Are the vehicles clean and well-maintained?", a: "All vehicles are professionally cleaned and sanitised before every trip. Our fleet is maintained to the highest standards and all drivers carry fresh water, phone chargers, and sanitiser as standard." },
      { q: "Can I request a specific vehicle model?", a: "We'll do our best to accommodate specific model requests. Please add a note in the Special Requests field when booking, or contact us directly to confirm availability." },
      { q: "Do your vehicles have WiFi?", a: "Yes. All vehicles in our fleet are equipped with complimentary 4G WiFi. Luxury and VIP vehicles additionally feature premium sound systems and USB-C charging points." },
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
      { q: "Can I add child seats to my booking?", a: "Yes. Baby Seats (0–13 kg), Child Seats (9–18 kg), and Booster Seats (15–36 kg) are €5 per seat. Ask for them under Special Requests when booking, and please specify your child's weight so we can provide the correct seat." },
      { q: "Can I bring my pet?", a: "Pets are welcome with prior notice. Tell us under Special Requests when booking and we will confirm the arrangement and any cleaning charge before you travel. Please ensure your pet is in a carrier or on a lead. Our drivers are pet-friendly." },
      { q: "What is the Meet & Greet service?", a: "It is included in every airport transfer at no extra charge. Your driver waits inside the arrivals hall with a name board, assists with your luggage from baggage reclaim, and escorts you to the vehicle. Airport pickups also include 60 minutes of free waiting from your actual landing time." },
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
