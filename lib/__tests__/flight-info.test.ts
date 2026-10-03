import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeFlight, clock, type FlightStatusDTO } from "@/lib/flights/present";
import { AeroDataBoxProvider } from "@/lib/flights/aerodatabox";

/**
 * The flight, as a chauffeur reads it.
 *
 * Status, when it lands or landed, and where to stand (terminal, gate, belt).
 * The rule underneath all of it: say what the provider said and no more. A gate
 * that has not been assigned reads "Not assigned yet", a landing time is shown
 * only once there is one, and a flight with no data says so.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const base: FlightStatusDTO = {
  flightNumber: "VY8465", state: "scheduled",
  scheduledArrival: "2026-10-03T13:35:00Z", estimatedArrival: "2026-10-03T13:35:00Z", delayMinutes: 0,
  arrivalAirport: "BCN", arrivalAirportName: "Barcelona El Prat", arrivalTerminal: "1", arrivalGate: null, baggageBelt: null,
  departureAirport: "LHR", departureAirportName: "London Heathrow", departureTerminal: "5", departureGate: null,
  scheduledDeparture: "2026-10-03T10:30:00Z", actualDeparture: null, landedAt: null,
  airline: "Vueling", aircraft: "Airbus A320",
};
const NOW = new Date("2026-10-03T08:00:00Z");

describe("what the card says", () => {
  it("shows a landed flight with its touchdown time, gate and belt", () => {
    const v = describeFlight({ ...base, state: "landed", landedAt: "2026-10-03T13:41:00Z", arrivalGate: "B12", baggageBelt: "5" }, NOW);
    expect(v.headline).toBe("Landed");
    expect(v.tone).toBe("landed");
    expect(v.times).toContainEqual({ label: "Landed", value: "15:41", emphasis: true });
    expect(v.place).toEqual([
      { label: "Terminal", value: "T1", known: true },
      { label: "Gate", value: "B12", known: true },
      { label: "Belt", value: "5", known: true },
    ]);
    expect(v.note).toContain("15:41");
  });

  it("does not invent a landing time for a plane that has not landed", () => {
    const v = describeFlight({ ...base, state: "en_route", estimatedArrival: "2026-10-03T14:25:00Z", delayMinutes: 50 }, NOW);
    expect(v.times.map((t) => t.label)).not.toContain("Landed");
    expect(v.times).toContainEqual({ label: "Expected", value: "16:25", emphasis: true });
    expect(v.tone).toBe("late");
    expect(v.headline).toBe("In the air, 50 min late");
  });

  it("says plainly when a gate or belt is not known yet", () => {
    const v = describeFlight(base, NOW);
    const gate = v.place.find((p) => p.label === "Gate")!;
    const belt = v.place.find((p) => p.label === "Belt")!;
    expect(gate).toEqual({ label: "Gate", value: "Not assigned yet", known: false });
    expect(belt.known).toBe(false);
  });

  it("tells the driver to ring dispatch for a cancelled or diverted flight", () => {
    for (const state of ["cancelled", "diverted"] as const) {
      const v = describeFlight({ ...base, state }, NOW);
      expect(v.tone).toBe("bad");
      expect(v.note).toMatch(/dispatch/i);
      // The old landing estimate is not offered as if it still applied.
      expect(v.times.map((t) => t.label)).not.toContain("Expected");
    }
  });

  it("separates 'has not left' from 'left'", () => {
    expect(describeFlight({ ...base, state: "scheduled" }, NOW).note).toBe("Has not left yet.");
    expect(describeFlight({ ...base, state: "scheduled", actualDeparture: "2026-10-03T10:34:00Z" }, NOW).note).toContain("12:34");
  });

  it("calls a delayed flight delayed, with the new time", () => {
    const v = describeFlight({ ...base, state: "delayed", estimatedArrival: "2026-10-03T14:40:00Z", delayMinutes: 65 }, NOW);
    expect(v.headline).toBe("Delayed 65 min");
    expect(v.note).toContain("16:40");
  });

  it("does not claim anything for a flight with no data", () => {
    const v = describeFlight({ ...base, state: "unknown", estimatedArrival: null, delayMinutes: null }, NOW);
    expect(v.tone).toBe("neutral");
    expect(v.headline).toBe("No live update yet");
    expect(v.note).toMatch(/pickup time on the booking still stands/i);
  });

  it("uses Barcelona's clock, not the phone's", () => {
    // 13:35 UTC is 15:35 in Barcelona in October.
    expect(clock("2026-10-03T13:35:00Z")).toBe("15:35");
    // And winter time is one hour, not two.
    expect(clock("2026-12-03T13:35:00Z")).toBe("14:35");
  });

  it("adds the day only when the flight is not today", () => {
    const v = describeFlight({ ...base, scheduledArrival: "2026-10-04T13:35:00Z", estimatedArrival: "2026-10-04T13:35:00Z" }, NOW);
    expect(v.times[0].value).toMatch(/15:35 · 04 Oct/);
    const same = describeFlight(base, NOW);
    expect(same.times[0].value).toBe("15:35");
  });
});

describe("what the provider gives us", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("AERODATABOX_KEY", "test");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  const payload = (status: string, arrival: Record<string, unknown>) => [{
    number: "VY 8465", status, airline: { name: "Vueling" }, aircraft: { model: "Airbus A320" },
    departure: { airport: { iata: "LHR", name: "London Heathrow" }, terminal: "5", gate: "B32", scheduledTime: { utc: "2026-10-03 10:30Z" }, actualTime: { utc: "2026-10-03 10:34Z" } },
    arrival: { airport: { iata: "BCN", name: "Barcelona El Prat" }, terminal: "1", scheduledTime: { utc: "2026-10-03 13:35Z" }, ...arrival },
  }];
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => "" });

  it("reads the gate, belt, aircraft and touchdown time of a flight that has landed", async () => {
    fetchMock.mockResolvedValue(ok(payload("Arrived", {
      gate: "B12", baggageBelt: "5",
      runwayTime: { utc: "2026-10-03 13:41Z" }, actualTime: { utc: "2026-10-03 13:46Z" },
    })));
    const s = (await new AeroDataBoxProvider().lookup("VY8465", new Date("2026-10-03T08:00:00Z")))!;
    expect(s.state).toBe("landed");
    expect(s.arrivalGate).toBe("B12");
    expect(s.baggageBelt).toBe("5");
    expect(s.aircraft).toBe("Airbus A320");
    expect(s.departureGate).toBe("B32");
    // Touchdown is the runway time, not the time it reached the stand.
    expect(s.landedAt?.toISOString()).toBe("2026-10-03T13:41:00.000Z");
  });

  it("leaves the gate, belt and landing time empty before they exist", async () => {
    fetchMock.mockResolvedValue(ok(payload("Expected", {})));
    const s = (await new AeroDataBoxProvider().lookup("VY8465", new Date("2026-10-03T08:00:00Z")))!;
    expect(s.state).toBe("scheduled");
    expect(s.arrivalGate).toBeNull();
    expect(s.baggageBelt).toBeNull();
    expect(s.landedAt).toBeNull();
  });

  it("does not report a landing time for a flight that has not landed, even with a revised time", async () => {
    fetchMock.mockResolvedValue(ok(payload("Departed", { revisedTime: { utc: "2026-10-03 14:20Z" } })));
    const s = (await new AeroDataBoxProvider().lookup("VY8465", new Date("2026-10-03T08:00:00Z")))!;
    expect(s.state).toBe("en_route");
    expect(s.landedAt).toBeNull();
    expect(s.estimatedArrival?.toISOString()).toBe("2026-10-03T14:20:00.000Z");
  });
});

describe("who can see it", () => {
  it("lets a fleet company read the flight of a job sent to it, and no one else's", () => {
    const api = rd("app/api/flights/status/route.ts");
    expect(api).toContain("partnerId: true");
    expect(api).toMatch(/user\?\.role === "PARTNER" && Boolean\(booking\.partnerId\)/);
    expect(api).toContain("=== booking.partnerId");
    expect(api).toMatch(/\|\|\s*ownsAsPartner/);
  });

  it("is on the driver's job and the fleet company's ride sheet", () => {
    expect(rd("components/driver/DriverDashboard.tsx")).toContain("<FlightInfoCard bookingId={b.id} flightNumber={b.flightNumber} />");
    const sheet = rd("app/partner/(panel)/jobs/page.tsx");
    expect(sheet).toContain("<FlightInfoCard bookingId={job.id} flightNumber={job.flightNumber} />");
    // Not on a ride that is over.
    expect(sheet).toMatch(/\["COMPLETED", "CANCELLED", "REFUNDED"\]\.includes\(job\.status\)/);
  });

  it("does not poll hard against a monthly quota", () => {
    const card = rd("components/flight/FlightInfoCard.tsx");
    expect(card).toContain("const REFRESH_MS = 5 * 60 * 1000");
    // Only while the screen is actually showing.
    expect(card).toContain('document.visibilityState === "visible"');
    // And the provider call is cached for ten minutes on the server.
    expect(rd("lib/flights/aerodatabox.ts")).toContain("revalidate: 600");
  });
});
