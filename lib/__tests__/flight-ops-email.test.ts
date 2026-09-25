import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flightOpsCard } from "@/lib/email/premium";

/**
 * The alert operations actually reads when a flight slips.
 *
 * It used to be four lines of plain text in a grey box — flight number, new
 * landing time, pickup, driver — which answers "how late" and nothing else.
 * Whether that estimate was worth moving a chauffeur for depends on things
 * the box never said: has the aircraft even left, how late did it leave, and
 * which terminal does it come into. All of it was already in the provider's
 * response and was being discarded.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const full = {
  confirmationCode: "DNWCDNSN",
  flightNumber: "TK1855",
  airline: "Turkish Airlines",
  state: "delayed",
  delayMinutes: 27,
  from: { code: "IST", name: "Istanbul Airport", terminal: "I", scheduled: "14:15", actual: "14:42" },
  to:   { code: "BCN", name: "Barcelona El Prat", terminal: "1", scheduled: "17:40", estimated: "18:07" },
  duration: "3h 25m",
  pickupAddress: "Terminal 1, el Prat de Llobregat",
  passenger: "Aaron Donovan",
  driver: null,
  bookingUrl: "https://www.elitebcn.info/admin/bookings",
};

describe("the whole flight, not just the landing time", () => {
  const html = flightOpsCard(full);

  it("says when it left and when it lands, scheduled against actual", () => {
    expect(html).toContain("14:42");         // wheels up
    expect(html).toContain("14:15");         // scheduled departure
    expect(html).toContain("18:07");         // revised landing
    expect(html).toContain("17:40");         // scheduled landing
    expect(html).toContain("Took off");
    expect(html).toContain("Now lands");
    expect(html).toContain("3h 25m");
  });

  /** Which door the chauffeur drives to is the operative fact. */
  it("names both terminals", () => {
    expect(html).toContain("Terminal I");
    expect(html).toContain("Terminal 1");
  });

  it("carries the route, the airline and the booking it belongs to", () => {
    expect(html).toContain("IST");
    expect(html).toContain("BCN");
    expect(html).toContain("Turkish Airlines");
    expect(html).toContain("DNWCDNSN");
    expect(html).toContain("Aaron Donovan");
    expect(html).toContain("TK1855 is 27 minutes late");
  });

  it("says plainly that nobody is driving it yet", () => {
    expect(html).toContain("Not yet assigned");
    expect(html).toContain("No driver is assigned yet");
  });

  it("names the driver instead, once there is one", () => {
    const withDriver = flightOpsCard({ ...full, driver: "Marc Puig" });
    expect(withDriver).toContain("Marc Puig has been told");
    expect(withDriver).not.toContain("Not yet assigned");
  });
});

describe("the states that mean the car may not be wanted", () => {
  /**
   * Red is kept for these two. A late flight is routine; colouring it red as
   * well would mean neither colour said anything.
   */
  for (const state of ["cancelled", "diverted"]) {
    it(`${state} reads as serious, and says to check before dispatching`, () => {
      const html = flightOpsCard({ ...full, state, delayMinutes: null });
      expect(html).toContain("#C2553F");
      expect(html).toContain("may not be wanted");
      expect(html).toContain(`TK1855 is ${state}`);
    });
  }

  it("a late flight stays gold", () => {
    const html = flightOpsCard(full);
    expect(html).toContain("#B68D4C");
    expect(html).not.toContain("#C2553F");
    expect(html).not.toContain("may not be wanted");
  });
});

describe("when the provider knows less", () => {
  const sparse = flightOpsCard({
    ...full,
    airline: null, duration: null, passenger: null,
    from: { code: "LGW", name: null, terminal: null, scheduled: "06:30", actual: null },
    to:   { code: "BCN", name: null, terminal: null, scheduled: "09:45", estimated: null },
  });

  /** A row with a label and no value reads as a broken email, not a quiet one. */
  it("leaves out what it does not know rather than printing empty labels", () => {
    expect(sparse).not.toContain("Terminal null");
    expect(sparse).not.toContain("Terminal undefined");
    expect(sparse).not.toContain("null");
    expect(sparse).not.toContain("undefined");
    expect(sparse).not.toContain("Scheduled</div>\n      <div");
  });

  it("still gives the reader somewhere to be", () => {
    expect(sparse).toContain("LGW");
    expect(sparse).toContain("06:30");
    expect(sparse).toContain("Departs");
    expect(sparse).toContain("Lands");
  });
});

describe("what it will not let through", () => {
  it("escapes the values it is handed", () => {
    const html = flightOpsCard({
      ...full,
      passenger: '<script>alert(1)</script>',
      pickupAddress: 'Hotel "Arts" & Spa',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  /** headline() renders raw, so the flight number has to arrive escaped. */
  it("escapes the flight number into the headline", () => {
    expect(rd("lib/email/premium.ts")).toContain("const fn = esc(o.flightNumber);");
  });
});

describe("the data behind it", () => {
  it("the provider keeps the departure half it used to discard", () => {
    const adb = rd("lib/flights/aerodatabox.ts");
    expect(adb).toContain("scheduledDeparture:   parseTime(f.departure?.scheduledTime)");
    expect(adb).toContain("actualDeparture:      parseTime(f.departure?.actualTime)");
    expect(adb).toContain("departureTerminal:    f.departure?.terminal");
    expect(adb).toContain("departureAirportName: f.departure?.airport?.name");
  });

  it("the sweep sends it, and still sends the one-line WhatsApp", () => {
    const sweep = rd("lib/flights/sweep.ts");
    expect(sweep).toContain("sendOpsFlightAlert({");
    expect(sweep).toContain("scheduled: clockText(status.scheduledDeparture)");
    expect(sweep).toContain("actual:    clockText(status.actualDeparture)");
    expect(sweep).toContain("terminal:  status.arrivalTerminal");
    // The phone alert is deliberately still one line, and is now collected
    // rather than fired and forgotten: an unawaited send does not survive the
    // cron returning.
    expect(sweep).toContain("pending.push(notifyAdmin(");
    expect(sweep).toContain("await Promise.allSettled(pending)");
  });

  it("the subject line says which flight and how late, not just 'Flight delay'", () => {
    const resend = rd("lib/resend.ts");
    expect(resend).toContain("min late — ${o.confirmationCode}");
    // And the inbox preview is the whole alert for anyone who never opens it.
    expect(resend).toContain("const preheader = [");
    expect(resend).toContain("Terminal ${o.to.terminal}");
  });
});
