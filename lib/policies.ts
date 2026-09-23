/**
 * The company's operating policies, in one place.
 *
 * The cancellation window, the meet-and-greet protocol at El Prat, what
 * happens to luggage and what the law requires for children were each
 * written out separately on the Terms page, the FAQ, the refund page and in
 * the confirmation email, which is how four versions of the same rule end up
 * on one website. Everything below is rendered by all of them.
 *
 * Prose only. The numbers behind the cancellation rules live in
 * lib/checkout-money.ts, which is also what the refund route runs on, so a
 * policy sentence and the code that honours it cannot drift apart.
 */

import { CANCEL_WINDOW_HOURS, PROTECTION_PERCENT, PROTECTION_CUTOFF_HOURS, DEPOSIT_PERCENT } from "@/lib/checkout-money";

export interface PolicySection {
  id: string;
  heading: string;
  /** One sentence introducing the section, where it needs one. */
  lead?: string;
  points: string[];
  /** A closing line set apart from the list. */
  note?: string;
}

/** The free-cancellation window, said once, in the order a customer meets it. */
export const CANCELLATION_WINDOWS: string[] = [
  `City journeys, including the airport and the cruise port: free cancellation more than ${CANCEL_WINDOW_HOURS.CITY} hours before pickup.`,
  `Journeys outside the city (Costa Brava, Costa Daurada, Girona, Tarragona, Andorra and similar): free cancellation more than ${CANCEL_WINDOW_HOURS.INTERCITY} hours before pickup.`,
  `Minibus and group bookings: free cancellation more than ${CANCEL_WINDOW_HOURS.MINIBUS} hours before pickup.`,
];

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "cancellation",
    heading: "Cancellation and refunds",
    lead: "The free-cancellation window depends on the journey, because the further the car travels the earlier we commit a chauffeur to it.",
    points: [
      ...CANCELLATION_WINDOWS,
      "Cancel inside the window and the fare is not refunded. A chauffeur has been reserved for you and the slot can no longer be sold.",
      "If something serious happens inside that window, such as a cancelled flight, contact us on WhatsApp with proof. We look at every case on its own merits and decide whether to refund. This is a goodwill decision, not an entitlement.",
      "A no-show is charged in full.",
      "A flight delay is not a cancellation. We track your flight and move the pickup to the new landing time at no charge.",
    ],
  },
  {
    id: "protection",
    heading: "Cancellation protection",
    lead: `An optional add-on at the checkout, priced at ${PROTECTION_PERCENT}% of the fare.`,
    points: [
      `It holds your booking until ${PROTECTION_CUTOFF_HOURS} hours before pickup: cancel any time up to then, for any reason, and the fare is refunded in full.`,
      `Inside the final ${PROTECTION_CUTOFF_HOURS} hours the fare is not refunded, with or without protection.`,
      "The protection fee itself is never refunded. It is what pays for holding the slot, and it stays with the company in every case, including when the fare is refunded.",
    ],
  },
  {
    id: "deposit",
    heading: "Paying a deposit",
    points: [
      `At the checkout you may pay ${DEPOSIT_PERCENT}% now and the rest to your chauffeur at the end of the journey, in cash or by card.`,
      "The cancellation rules apply to what you have actually paid. Cancel inside the window, or fail to show, and the deposit is not returned.",
      "Cancellation protection, when taken, is always paid in full with the deposit.",
    ],
  },
  {
    id: "meet-greet",
    heading: "Meet and greet with a name board",
    lead: "An optional extra, added at the checkout, for an airport arrival. An international arrival takes as long as it takes. Passport control and baggage reclaim can run to an hour, sometimes two, and no chauffeur can stand inside for all of it. This is how we handle it, and it works when you follow the steps.",
    points: [
      "Your chauffeur waits outside and follows your flight. Nothing is charged for the wait.",
      "When you reach baggage reclaim, message your chauffeur: \"please come to the meeting point\". That message is what starts them moving.",
      "Give your chauffeur ten minutes from that message to reach the meeting point. They are coming in from the car park on foot.",
      "Terminal 1 and Terminal 2B: the meeting point is in the arrivals hall by the Como restaurant. Terminal 2A: your chauffeur waits directly in front of the arrivals door.",
      "Your chauffeur carries the name board and helps with your bags from the meeting point to the car.",
      "If you are already in the arrivals hall and your chauffeur has not appeared within those ten minutes, you can ask for the meet-and-greet fee back and we will refund it.",
    ],
    note: "Terminal 2 has a long walk from the main car park. If you would rather not make it, tell your chauffeur when you are ready and ask them to come to the express car park instead. They park there, walk into the hall with your name board and meet you, and the walk back to the car is much shorter. Airport parking is expensive, and keeping it short is part of how our fares stay where they are.",
  },
  {
    id: "luggage",
    heading: "Luggage",
    points: [
      "Book the vehicle for the luggage, not only for the number of passengers. Every vehicle page lists how many large cases it takes.",
      "If the luggage does not fit on the day, we can arrange a second vehicle. It is charged separately.",
      "Luggage travels in the boot, not in the passenger compartment. Loose cases inside the cabin are dangerous in a sudden stop.",
      "Your chauffeur loads and unloads the vehicle. If you insist on handling the luggage yourself, any damage or loss is not covered by our insurance, and neither is injury in the event of an accident caused by it.",
    ],
  },
  {
    id: "children",
    heading: "Children, babies and pets",
    lead: "Tell us when you book. A car that turns up without the right seat cannot legally take your child.",
    points: [
      "Spanish law requires every child of 135 cm or under to travel in an approved child restraint system. The exemption that applies to metered taxis on urban journeys does not extend to licensed VTC vehicles such as ours, so a seat is required on every journey we make.",
      "We carry one baby seat and one booster seat on request. Both are an extra charge and must be requested when you book, so the seat is fitted before the car is dispatched.",
      "Pets are welcome with prior notice, in a carrier or on a lead. Tell us when you book so we can confirm the vehicle and any cleaning charge before you travel.",
    ],
  },
];

/**
 * What happens when the customer arrives, for their confirmation email.
 *
 * This is the one thing they need on the day and the one thing the emails
 * never said. Someone who did not buy meet and greet was told nothing about
 * where to go, and would look inside the arrivals hall for a chauffeur who
 * is standing, correctly, outside it. Someone who did buy it was not told
 * that the chauffeur waits outside until messaged, and that it takes them
 * ten minutes to walk in.
 *
 * Only an airport pickup gets the terminal detail. Anywhere else the
 * arrangement is simply that the car comes to the address.
 */
export function arrivalInstructions(o: {
  airportPickup: boolean;
  meetGreet: boolean;
  nameBoard: boolean;
}): { heading: string; points: string[] } {
  if (!o.airportPickup) {
    return {
      heading: "On the day",
      points: [
        "Your chauffeur arrives at the pickup address at the booked time and calls you when they are outside.",
        "Fifteen minutes of waiting is included at any address that is not an airport.",
        "You get your chauffeur's name, phone number and vehicle as soon as they are assigned, and can follow the car on a live map from the link in this email.",
      ],
    };
  }

  const board = o.nameBoard || o.meetGreet;

  if (o.meetGreet) {
    return {
      heading: "Meeting your chauffeur at the airport",
      points: [
        "Your chauffeur follows your flight and waits outside the terminal. Nothing is charged for that wait, however late you land.",
        'When you reach baggage reclaim, message your chauffeur: "please come to the meeting point". That message is what starts them walking in.',
        "Give them ten minutes from that message. They are coming in on foot from the car park.",
        "Terminal 1 and Terminal 2B: the meeting point is inside the arrivals hall, by the Como restaurant. Terminal 2A: your chauffeur waits directly in front of the arrivals door.",
        board
          ? "They will be holding a board with your name on it, and will help with your bags to the car."
          : "They will help with your bags to the car.",
        "If you are in the arrivals hall and they have not appeared within those ten minutes, reply to this email and we refund the meet and greet fee.",
      ],
    };
  }

  return {
    heading: "Where your chauffeur will be waiting",
    points: [
      "Your chauffeur waits at the designated meeting point just outside your terminal, next to the taxi rank where reserved VTC cars are allowed to park. They are not inside the arrivals hall.",
      "They track your flight and call you shortly after you land. Sixty minutes of waiting from your actual landing time is included.",
      "Come out through arrivals and follow the signs for taxis. Your chauffeur will be there with the car.",
      board
        ? "You have added a name board, so your chauffeur will be holding a board with your name at that meeting point."
        : "Would you rather be met inside the arrivals hall, with your name on a board and help with your bags from baggage reclaim? Reply to this email and we will add meet and greet for 5 euros.",
    ],
  };
}

export function policySection(id: string): PolicySection | undefined {
  return POLICY_SECTIONS.find((s) => s.id === id);
}

/**
 * The short version, for the checkout and the confirmation email.
 *
 * Five lines. Anything longer is not read at the moment a card number is
 * being typed, and anything shorter leaves out something a customer later
 * says they were not told.
 */
export const CHECKOUT_POLICY_POINTS: string[] = [
  `Free cancellation up to ${CANCEL_WINDOW_HOURS.CITY} hours before a city pickup, ${CANCEL_WINDOW_HOURS.INTERCITY} hours outside the city, ${CANCEL_WINDOW_HOURS.MINIBUS} hours for a minibus. Inside that window the fare is not refunded.`,
  `Cancellation protection holds your booking until ${PROTECTION_CUTOFF_HOURS} hours before pickup and refunds the fare in full. The protection fee itself is never refunded.`,
  "A delayed flight is never a cancellation. We track it and move your pickup at no charge.",
  "Meet and greet is an optional extra. With it, message your chauffeur from baggage reclaim and allow ten minutes for them to reach the meeting point; without it, they wait at the meeting point outside the terminal.",
  "Travelling with a child of 135 cm or under, or with a pet? Tell us when you book. Spanish law requires an approved child seat and we fit it before the car leaves.",
];
