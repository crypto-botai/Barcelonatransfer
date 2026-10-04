import { describe, it, expect } from "vitest";
import {
  cancelledFields, completedFields, confirmationFields, driverAssignedFields, driverCancelledFields, driverJobFields, requestFields,
  type MessageBooking,
} from "@/lib/whatsapp-messages";
import { TEMPLATE_DEFS } from "@/lib/whatsapp-template-defs";

/**
 * The words that fill each template.
 *
 * Two things matter. Every slot a template has must be filled by a field the
 * builder actually returns, or a customer reads a dash where their driver's
 * name should be. And a chauffeur's message must not contain the customer's
 * price, the price of an extra, or a tip: not because it is hidden, but because
 * it is never read.
 */

const meta = (extras: unknown[], more: Record<string, unknown> = {}) =>
  `[META]${JSON.stringify({ extras, tipAmount: 12, memberTier: "GOLD", ...more })}[/META]\nQuiet driver please`;

const EXTRAS = [
  { id: "baby_seat", label: "Baby Seat", price: 5, quantity: 2 },
  { id: "meet_greet", label: "Meet & Greet", price: 5, quantity: 1 },
  { id: "invoice_vat", label: "I need an invoice", price: 0, quantity: 1 },
];

const booking = (over: Partial<MessageBooking> = {}): MessageBooking => ({
  confirmationCode: "EBC-4821", status: "CONFIRMED",
  guestName: "Ana Smith", guestEmail: "ana@example.com", guestPhone: "+34600123456",
  pickupAddress: "Barcelona Airport T1", dropoffAddress: "Hotel Arts, Carrer de la Marina 19",
  pickupDatetime: new Date("2026-10-14T10:00:00Z"), passengers: 3, luggage: 2, vehicleClass: "BUSINESS", flightNumber: "VY1875",
  specialRequests: meta(EXTRAS), totalAmount: 287.5, paymentStatus: "PAID", paymentMethod: "CARD_LINK",
  depositAmount: null, balanceAmount: null, balancePaidAt: null, driverAmount: 50, ...over,
});

const driver = { name: "Pedro Ruiz", phone: "+34611222333", vehicle: { make: "Mercedes", model: "E-Class", licensePlate: "1234 ABC" } };

const def = (name: string) => TEMPLATE_DEFS.find((t) => t.name === name)!;

describe("every slot of every template is filled", () => {
  const cases: [string, Record<string, string>][] = [
    ["elitebcn_booking_confirmation", confirmationFields(booking())],
    ["elitebcn_new_request", requestFields({ name: "Ana", phone: "+34600123456" })],
    ["elitebcn_driver_assigned", driverAssignedFields(booking(), driver)],
    ["elitebcn_driver_new_job", driverJobFields(booking())],
    ["elitebcn_job_completed", completedFields(booking(), "https://www.elitebcn.info/review?booking=b1")],
    ["elitebcn_booking_cancelled", cancelledFields(booking())],
    ["elitebcn_driver_job_cancelled", driverCancelledFields(booking())],
  ];

  it.each(cases)("%s", (name, fields) => {
    for (const f of def(name).fields) {
      expect(fields, `${name} has a slot for "${f}" that nothing fills`).toHaveProperty(f);
      expect(fields[f].trim().length, `${name}: "${f}" is empty`).toBeGreaterThan(0);
      // Meta refuses a field with a line break or a run of spaces.
      expect(fields[f], `${name}: "${f}"`).not.toMatch(/\n|\t| {4,}/);
    }
  });
});

describe("the confirmation, for the customer and the office", () => {
  it("shows the whole booking, the real price and where the payment stands", () => {
    const f = confirmationFields(booking());
    expect(f).toMatchObject({
      when: expect.stringContaining("2026"), name: "Ana Smith", phone: "+34600123456", email: "ana@example.com",
      pickup: "Barcelona Airport T1", dropoff: "Hotel Arts, Carrer de la Marina 19", flight: "VY1875", passengers: "3", luggage: "2",
      vehicleType: "Business", ref: "EBC-4821", price: "€287.50", payment: "Paid in full",
    });
    expect(f.requests).toBe("Quiet driver please");
  });

  it("lists the extras with what each cost, because the customer bought them", () => {
    const f = confirmationFields(booking());
    expect(f.extras).toContain("Baby Seat");
    expect(f.extras).toMatch(/€10/);
  });

  it("counts the children from the child seats ordered", () => {
    expect(confirmationFields(booking()).children).toBe("2 (Baby Seat x2)");
    expect(confirmationFields(booking({ specialRequests: null })).children).toBe("None");
  });

  it("has no driver in it: a booking comes in from the customer, and nobody is assigned yet", () => {
    const f = confirmationFields(booking({ driverAmount: 50 }));
    expect(Object.keys(f).join(" ")).not.toMatch(/driver|confirmedVehicle|plate/i);
    expect(Object.values(f).join(" ")).not.toMatch(/to be assigned|pedro/i);
    // The template cannot show one either.
    const d = def("elitebcn_booking_confirmation");
    expect(d.body).not.toMatch(/driver|chauffeur|confirmed vehicle/i);
    expect(d.fields.join(" ")).not.toMatch(/driver|confirmedVehicle|plate/i);
  });

  it("the chauffeur is told in his own message, once somebody is assigned", () => {
    expect(def("elitebcn_driver_assigned").body).toMatch(/CHAUFFEUR ASSIGNED/);
    expect(driverAssignedFields(booking(), driver).driver).toBe("Pedro Ruiz");
  });

  it("states a deposit, cash and unpaid booking each in its own words", () => {
    expect(confirmationFields(booking({ depositAmount: 86.25, balanceAmount: 201.25 })).payment).toMatch(/€86\.25 paid, €201\.25 balance due to the chauffeur/);
    expect(confirmationFields(booking({ paymentStatus: "PENDING", paymentMethod: "CASH" })).payment).toBe("Cash to chauffeur");
    expect(confirmationFields(booking({ paymentStatus: "PENDING", paymentMethod: "CARD_LINK" })).payment).toBe("Pending payment");
  });

  it("fills what the customer did not give with something readable, never an empty slot", () => {
    const f = confirmationFields(booking({ guestName: null, guestEmail: null, guestPhone: null, flightNumber: null, dropoffAddress: null, specialRequests: null }));
    expect(f).toMatchObject({ name: "-", email: "-", phone: "-", flight: "None", dropoff: "As arranged", requests: "None", extras: "None" });
  });
});

describe("a new request for the office", () => {
  it("shows what a lead has told us and says what it has not", () => {
    const f = requestFields({ name: "Ana", phone: "+34600123456", pickup: "Barcelona Airport T1", passengers: 2 });
    expect(f).toMatchObject({ name: "Ana", phone: "+34600123456", pickup: "Barcelona Airport T1", passengers: "2", email: "Not given yet", dropoff: "Not given yet", flight: "Not given yet", vehicleType: "Not chosen yet" });
  });
});

describe("the chauffeur's job message", () => {
  const f = driverJobFields(booking());
  const text = Object.values(f).join(" | ");

  it("has the job: who, where, when, how many, and the extras by name", () => {
    expect(f).toMatchObject({ ref: "EBC-4821", passenger: "Ana Smith", passengerPhone: "+34600123456", pickup: "Barcelona Airport T1", flight: "VY1875", passengers: "3", luggage: "2", children: "2 (Baby Seat x2)" });
    expect(f.extras).toBe("Baby Seat ×2, Meet & Greet");
    expect(f.requests).toBe("Quiet driver please");
  });

  it("shows the one fare set for the chauffeur, and never the customer's price", () => {
    expect(f.fare).toBe("€50");
    expect(text).not.toContain("287");
    expect(text).not.toContain("250");
  });

  it("shows no price for any extra, no tip and no membership", () => {
    expect(text).not.toMatch(/€\s?5\b/);   // an extra is €5 each: it must not appear as a price
    expect(text).not.toMatch(/€\s?10\b/);
    expect(text).not.toMatch(/€\s?12\b/);  // the tip
    expect(text).not.toMatch(/gold/i);     // the membership tier
    expect(text).not.toMatch(/invoice/i);  // an account matter, not something to bring
  });

  it("says plainly when the fare was not set, rather than guessing", () => {
    expect(driverJobFields(booking({ driverAmount: null })).fare).toBe("As agreed with dispatch");
  });

  it("gives the cash to take as an instruction: nothing when paid, the balance on a deposit, the lot when unpaid", () => {
    expect(f.collect).toBe("Paid online, nothing to collect");
    expect(driverJobFields(booking({ depositAmount: 86.25, balanceAmount: 201.25 })).collect).toBe("Collect €201.25 from the passenger");
    expect(driverJobFields(booking({ paymentStatus: "PENDING", paymentMethod: "CASH" })).collect).toBe("Collect €287.50 from the passenger");
  });

  it("does not read what it must not show", () => {
    // The builder for a chauffeur never reads the booking's price fields except to say what to collect.
    const f2 = driverJobFields(booking({ totalAmount: 999.99, driverAmount: 40, paymentStatus: "PAID" }));
    expect(Object.values(f2).join(" ")).not.toContain("999");
  });
});

describe("the customer's chauffeur message", () => {
  it("is the chauffeur, the number, the car and the plate", () => {
    expect(driverAssignedFields(booking(), driver)).toMatchObject({
      ref: "EBC-4821", driver: "Pedro Ruiz", driverContact: "+34611222333", vehicle: "Mercedes E-Class", plate: "1234 ABC", pickup: "Barcelona Airport T1",
    });
  });

  it("never carries a company name: there is no field for one", () => {
    expect(Object.keys(driverAssignedFields(booking(), driver)).join(" ")).not.toMatch(/company|partner|fleet/i);
  });
});

describe("completion and cancellation", () => {
  it("thanks the customer by first name and links to the rating", () => {
    expect(completedFields(booking(), "https://x/review")).toMatchObject({ name: "Ana", link: "https://x/review", ref: "EBC-4821" });
  });

  it("tells the customer and the chauffeur what was cancelled", () => {
    expect(cancelledFields(booking())).toMatchObject({ ref: "EBC-4821", name: "Ana", pickup: "Barcelona Airport T1" });
    expect(driverCancelledFields(booking())).toMatchObject({ ref: "EBC-4821", passenger: "Ana Smith", pickup: "Barcelona Airport T1" });
  });

  it("the chauffeur's cancellation carries no money either", () => {
    expect(Object.values(driverCancelledFields(booking())).join(" ")).not.toMatch(/€|287/);
  });
});

describe("the templates themselves", () => {
  it("follow the layout asked for: the header, the booking lines, the divider, the confirmation block, the sign-off", () => {
    const t = def("elitebcn_booking_confirmation").body;
    expect(t.startsWith("✨ *ELITEBCN | PREMIUM TRANSFER BOOKING* ✨")).toBe(true);
    expect(t).toContain("✅ *BOOKING CONFIRMATION DETAILS*");
    expect(t).toContain("💶 *Total Price:*");
    expect(t).toContain("💳 *Payment Status:*");
    expect(t.endsWith("✨ *Premium Transfers • Professional Service*")).toBe(true);
    expect(def("elitebcn_new_request").body.startsWith("✨ *ELITEBCN | PREMIUM TRANSFER REQUEST* ✨")).toBe(true);
  });

  it("the chauffeur's templates have no slot for a price other than the fare set for them", () => {
    for (const name of ["elitebcn_driver_new_job", "elitebcn_driver_job_cancelled"]) {
      const d = def(name);
      expect(d.to).toBe("driver");
      expect(d.fields.join(" "), name).not.toMatch(/price|total|amount|payment\b|tip|member/i);
    }
    expect(def("elitebcn_driver_new_job").fields).toContain("fare");
  });

  it("fits what Meta allows", () => {
    for (const t of TEMPLATE_DEFS) expect(t.body.length, t.name).toBeLessThanOrEqual(1024);
  });
});
