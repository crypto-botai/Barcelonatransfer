import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { normaliseFlightNumber, MATERIAL_DELAY_MINUTES, type FlightStatus } from "@/lib/flights/types";
import { AeroDataBoxProvider } from "@/lib/flights/aerodatabox";
import { isMaterialDelay, lookupFlight, getFlightProvider } from "@/lib/flights";

describe("normaliseFlightNumber", () => {
  it("accepts and cleans real designators", () => {
    expect(normaliseFlightNumber("ib 3456")).toBe("IB3456");
    expect(normaliseFlightNumber("VY-1234")).toBe("VY1234");
    expect(normaliseFlightNumber("u21234")).toBe("U21234");
    expect(normaliseFlightNumber("BA7")).toBe("BA7");
  });

  it("rejects things that are not flight numbers", () => {
    expect(normaliseFlightNumber("")).toBeNull();
    expect(normaliseFlightNumber("hello world")).toBeNull();
    expect(normaliseFlightNumber("123456")).toBeNull();
    expect(normaliseFlightNumber("IB99999")).toBeNull();   // 5 digits
  });
});

describe("isMaterialDelay", () => {
  const base: FlightStatus = {
    flightNumber: "IB3456", state: "scheduled",
    scheduledArrival: new Date("2026-09-01T10:00:00Z"),
    estimatedArrival: new Date("2026-09-01T10:00:00Z"),
    delayMinutes: 0,
    arrivalAirport: "BCN", arrivalTerminal: "1",
    departureAirport: "MAD", airline: "Iberia", source: "test",
  };

  it("ignores delays the free waiting time absorbs", () => {
    expect(isMaterialDelay({ ...base, delayMinutes: 0 })).toBe(false);
    expect(isMaterialDelay({ ...base, delayMinutes: MATERIAL_DELAY_MINUTES - 1 })).toBe(false);
  });

  it("flags delays at or over the threshold", () => {
    expect(isMaterialDelay({ ...base, delayMinutes: MATERIAL_DELAY_MINUTES })).toBe(true);
    expect(isMaterialDelay({ ...base, delayMinutes: 95 })).toBe(true);
  });

  it("always flags cancellation and diversion regardless of minutes", () => {
    expect(isMaterialDelay({ ...base, state: "cancelled", delayMinutes: null })).toBe(true);
    expect(isMaterialDelay({ ...base, state: "diverted",  delayMinutes: 0 })).toBe(true);
  });

  it("does not treat an unknown delay as a delay", () => {
    expect(isMaterialDelay({ ...base, delayMinutes: null })).toBe(false);
  });
});

describe("AeroDataBoxProvider", () => {
  const provider = new AeroDataBoxProvider();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("AERODATABOX_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  it("parses the non-ISO timestamp format and computes the delay", async () => {
    fetchMock.mockResolvedValue(ok([{
      number: "IB 3456",
      status: "Delayed",
      airline: { name: "Iberia" },
      departure: { airport: { iata: "MAD" } },
      arrival: {
        airport: { iata: "BCN" },
        terminal: "1",
        scheduledTime: { utc: "2026-09-01 10:00Z" },
        revisedTime:   { utc: "2026-09-01 10:45Z" },
      },
    }]));

    const s = await provider.lookup("IB3456", new Date("2026-09-01T00:00:00Z"));
    expect(s?.state).toBe("delayed");
    expect(s?.delayMinutes).toBe(45);
    expect(s?.scheduledArrival?.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(s?.arrivalTerminal).toBe("1");
    expect(s?.airline).toBe("Iberia");
  });

  it("trusts the revised clock over an optimistic status label", async () => {
    fetchMock.mockResolvedValue(ok([{
      number: "VY1001",
      status: "Expected",                                   // airline has not relabelled it
      arrival: {
        airport: { iata: "BCN" },
        scheduledTime: { utc: "2026-09-01 08:00Z" },
        revisedTime:   { utc: "2026-09-01 09:30Z" },        // but it is 90 min late
      },
    }]));

    const s = await provider.lookup("VY1001", new Date("2026-09-01T00:00:00Z"));
    expect(s?.state).toBe("delayed");
    expect(s?.delayMinutes).toBe(90);
  });

  it("picks the Barcelona leg when a designator returns several", async () => {
    fetchMock.mockResolvedValue(ok([
      { number: "IB1", arrival: { airport: { iata: "LHR" }, scheduledTime: { utc: "2026-09-01 06:00Z" } } },
      { number: "IB1", arrival: { airport: { iata: "BCN" }, scheduledTime: { utc: "2026-09-01 12:00Z" } } },
    ]));

    const s = await provider.lookup("IB1", new Date("2026-09-01T00:00:00Z"));
    expect(s?.arrivalAirport).toBe("BCN");
    expect(s?.scheduledArrival?.toISOString()).toBe("2026-09-01T12:00:00.000Z");
  });

  it("returns null rather than guessing when the flight is not found", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    expect(await provider.lookup("ZZ9999", new Date())).toBeNull();

    fetchMock.mockResolvedValue(ok([]));
    expect(await provider.lookup("ZZ9999", new Date())).toBeNull();
  });

  it("leaves estimatedArrival null when no revised time exists", async () => {
    // "We don't know yet" must not be reported as "on time".
    fetchMock.mockResolvedValue(ok([{
      number: "IB3456",
      status: "Expected",
      arrival: { airport: { iata: "BCN" }, scheduledTime: { utc: "2026-09-01 10:00Z" } },
    }]));

    const s = await provider.lookup("IB3456", new Date("2026-09-01T00:00:00Z"));
    expect(s?.estimatedArrival).toBeNull();
    expect(s?.delayMinutes).toBeNull();
    expect(s?.state).toBe("scheduled");
  });

  it("throws on auth failure so the caller falls back instead of displaying nothing", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" });
    await expect(provider.lookup("IB3456", new Date())).rejects.toThrow(/403/);
  });
});

describe("lookupFlight outcomes", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("reports not_configured when no provider has credentials", async () => {
    vi.stubEnv("AERODATABOX_KEY", "");
    expect(getFlightProvider()).toBeNull();
    expect(await lookupFlight("IB3456", new Date())).toEqual({ ok: false, reason: "not_configured" });
  });

  it("distinguishes an invalid number from a missing flight", async () => {
    vi.stubEnv("AERODATABOX_KEY", "test-key");
    const r = await lookupFlight("not a flight", new Date());
    expect(r).toEqual({ ok: false, reason: "invalid_number" });
  });

  it("converts a provider throw into provider_error rather than propagating", async () => {
    vi.stubEnv("AERODATABOX_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
    const r = await lookupFlight("IB3456", new Date());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("provider_error");
  });
});
