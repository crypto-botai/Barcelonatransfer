import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Confirming an address change actually writes the address.
 *
 * The rest of the journey tests read the route's source. This one runs it,
 * with the database, the router and the pricing engine mocked, and asserts on
 * what reaches prisma.booking.update — which is the only thing that decides
 * whether the office's change survives.
 */

const session = { user: { id: "admin-1", role: "ADMIN", name: "Office" } };
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => session) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const db = {
  booking: { findUnique: vi.fn(), update: vi.fn(async (a: { data: unknown }) => a.data) },
};
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const getQuote = vi.fn(async (_input?: unknown) => ({
  vehicleClass: "BUSINESS", distanceKm: 18.4, durationMin: 27,
  baseFare: 95, distanceFare: 0, airportSurcharge: 0, nightSurcharge: 0,
  lastMinuteSurcharge: 0, vatAmount: 0, totalAmount: 95, currency: "EUR",
  isFixed: true, isCustomRoute: false,
}));
vi.mock("@/lib/pricing-service", () => ({ getQuote: (i: unknown) => getQuote(i as never) }));

const roadDistance = vi.fn(async (): Promise<{ distanceKm: number; durationMin: number; precise: boolean }> =>
  ({ distanceKm: 18.4, durationMin: 27, precise: true }));
vi.mock("@/lib/geo", () => ({ roadDistance: () => roadDistance() }));

interface SentEmail {
  timeChanged?: boolean;
  oldPickupAddress?: string | null;
  oldDropoffAddress?: string | null;
  newDropoffAddress?: string | null;
}
const sendBookingRescheduledEmail = vi.fn(async (_arg: SentEmail) => "msg-1");
vi.mock("@/lib/resend", () => ({
  sendBookingRescheduledEmail: (a: unknown) => sendBookingRescheduledEmail(a as never),
}));

const { PATCH } = await import("@/app/api/admin/bookings/[id]/journey/route");

const AIRPORT = {
  pickupAddress: "Barcelona El Prat Airport (BCN), Terminal 1",
  pickupLat: 41.2971, pickupLng: 2.0785,
};
const HOTEL = {
  dropoffAddress: "Hotel Arts Barcelona",
  dropoffLat: 41.3859, dropoffLng: 2.1966,
};

/** 10:00 Barcelona on 5 Oct 2026 is 08:00 UTC (CEST). */
const PICKUP_AT = new Date("2026-10-05T08:00:00.000Z");

const row = (over: Record<string, unknown> = {}) => ({
  id: "bk_1", confirmationCode: "EB-1234", status: "CONFIRMED",
  pickupDatetime: PICKUP_AT,
  ...AIRPORT, ...HOTEL,
  vehicleClass: "BUSINESS", distanceKm: 14.2, durationMin: 22,
  baseFare: 65, totalAmount: 65, specialRequests: null,
  depositAmount: null, balanceAmount: null, balancePaidAt: null,
  guestName: "Ada", guestEmail: "ada@example.com", user: null,
  ...over,
});

const call = (body: Record<string, unknown>) =>
  PATCH(
    new Request("https://x/api/admin/bookings/bk_1/journey", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ id: "bk_1" }) },
  );

/** The data object handed to prisma.booking.update. */
const written = () => {
  const c = db.booking.update.mock.calls.at(-1);
  if (!c) throw new Error("nothing was written");
  return (c[0] as { data: Record<string, unknown> }).data;
};

const NEW_DROPOFF = { address: "Camp Nou, Barcelona", lat: 41.3809, lng: 2.1228 };

beforeEach(() => {
  vi.clearAllMocks();
  db.booking.findUnique.mockResolvedValue(row() as never);
  db.booking.update.mockImplementation(async (a: { data: unknown }) => ({
    id: "bk_1", pickupDatetime: PICKUP_AT, totalAmount: 95, balanceAmount: null,
    pickupAddress: AIRPORT.pickupAddress, dropoffAddress: NEW_DROPOFF.address, distanceKm: 18.4,
    ...(a.data as object),
  }));
});

describe("confirming a drop-off change", () => {
  it("writes the new address and its coordinates", async () => {
    const res = await call({
      date: "2026-10-05", time: "10:00",
      dropoff: NEW_DROPOFF,
      confirm: true,
    });
    expect(res.status).toBe(200);

    const data = written();
    expect(data.dropoffAddress).toBe("Camp Nou, Barcelona");
    expect(data.dropoffLat).toBe(41.3809);
    expect(data.dropoffLng).toBe(2.1228);
  });

  it("leaves the untouched pick-up exactly as it was", async () => {
    await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    const data = written();
    expect(data.pickupAddress).toBe(AIRPORT.pickupAddress);
    expect(data.pickupLat).toBe(41.2971);
  });

  it("stores the re-routed distance", async () => {
    await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    expect(written().distanceKm).toBe(18.4);
  });

  it("applies the requoted fare", async () => {
    await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    expect(written().totalAmount).toBe(95);
  });
});

describe("previewing changes nothing", () => {
  it("writes nothing without confirm", async () => {
    const res = await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF });
    const json = await res.json();
    expect(json.preview).toBe(true);
    expect(json.dropoffChanged).toBe(true);
    expect(db.booking.update).not.toHaveBeenCalled();
  });
});

describe("an address change with no time change", () => {
  /**
   * The office corrects a destination and touches nothing else. The original
   * pickup time must survive, and the route must still be recognised as
   * changed rather than rejected as "nothing has changed".
   */
  it("is accepted and keeps the original time", async () => {
    const res = await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timeChanged).toBe(false);
    expect(json.basis).toBe("requoted");
    expect((written().pickupDatetime as Date).toISOString()).toBe(PICKUP_AT.toISOString());
  });

  it("tells the customer the drop-off moved, not the time", async () => {
    await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    const sent = sendBookingRescheduledEmail.mock.calls.at(-1);
    if (!sent) throw new Error("no email was sent");
    const arg = sent[0];
    expect(arg.timeChanged).toBe(false);
    expect(arg.oldDropoffAddress).toBe(HOTEL.dropoffAddress);
    expect(arg.oldPickupAddress).toBeNull();
  });
});

describe("what is refused", () => {
  it("refuses an unchosen address reporting 0,0", async () => {
    const res = await call({
      date: "2026-10-05", time: "10:00",
      dropoff: { address: "Camp No", lat: 0, lng: 0 },
      confirm: true,
    });
    expect(res.status).toBe(422);
    expect(db.booking.update).not.toHaveBeenCalled();
  });

  it("refuses when truly nothing changed", async () => {
    const res = await call({ date: "2026-10-05", time: "10:00", confirm: true });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("Nothing has changed");
  });

  it("refuses to price a route the table cannot quote", async () => {
    getQuote.mockResolvedValueOnce({ needsManualQuote: true } as never);
    const res = await call({ date: "2026-10-05", time: "10:00", dropoff: NEW_DROPOFF, confirm: true });
    expect(res.status).toBe(422);
    expect(db.booking.update).not.toHaveBeenCalled();
  });
});
