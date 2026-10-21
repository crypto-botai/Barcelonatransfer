import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  session: null as unknown,
  booking: null as Record<string, unknown> | null,
  update: vi.fn(),
  log: vi.fn(),
  send: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: async () => m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findUnique: async () => m.booking, update: (a: unknown) => { m.update(a); return Promise.resolve({}); } },
    activityLog: { create: (a: unknown) => { m.log(a); return Promise.resolve({}); } },
  },
}));
vi.mock("@/lib/booking-email", async (orig) => ({ ...(await orig<typeof import("@/lib/booking-email")>()), sendConfirmationTo: (...a: unknown[]) => m.send(...a) }));

import { POST } from "@/app/api/admin/bookings/[id]/email/route";
import { isEmail } from "@/lib/booking-email";

const call = (body: unknown) =>
  POST(new Request("https://x.test/api/admin/bookings/b1/email", { method: "POST", body: JSON.stringify(body) }) as never, { params: Promise.resolve({ id: "b1" }) });

beforeEach(() => {
  m.session = { user: { id: "admin1", name: "Boss", role: "ADMIN" } };
  m.booking = { id: "b1", confirmationCode: "EBC-1", guestEmail: "old@example.com", isDeleted: false };
  m.update.mockReset(); m.log.mockReset(); m.send.mockReset();
  m.send.mockResolvedValue("confirmed");
});

describe("admin: change the booking email and resend the confirmation", () => {
  it("only an administrator can use it", async () => {
    for (const session of [null, { user: { id: "u", role: "CUSTOMER" } }, { user: { id: "d", role: "DRIVER" } }]) {
      m.session = session;
      expect((await call({ email: "new@example.com", send: true })).status).toBe(401);
    }
    expect(m.update).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("saves the new address on the booking, logs old and new with the admin's name, and sends to the new address", async () => {
    const res = await call({ email: "  New@Example.com ", send: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: "new@example.com", changed: true, sent: "confirmed" });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { guestEmail: "new@example.com" } });
    const actions = m.log.mock.calls.map((c) => c[0].data);
    expect(actions[0]).toMatchObject({ action: "BOOKING_EMAIL_CHANGED", adminName: "Boss", details: { from: "old@example.com", to: "new@example.com" } });
    expect(actions[1]).toMatchObject({ action: "BOOKING_CONFIRMATION_RESENT", details: { to: "new@example.com" } });
    expect(m.send).toHaveBeenCalledWith("b1", "new@example.com");
  });

  it("changes the address without sending when asked only to save", async () => {
    const res = await call({ email: "new@example.com" });
    expect((await res.json()).sent).toBeNull();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalled();
  });

  it("resends to the address already on the booking, without rewriting it", async () => {
    const res = await call({ send: true });
    expect(res.status).toBe(200);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.send).toHaveBeenCalledWith("b1", "old@example.com");
  });

  it("refuses an address that is not an email, and changes nothing", async () => {
    for (const email of ["", "nope", "a@b", "a b@c.com", "x@y.z"]) {
      expect((await call({ email, send: true })).status).toBe(422);
    }
    expect(m.update).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("keeps the new address when the send fails, and says so", async () => {
    m.send.mockRejectedValue(new Error("This booking is cancelled, so a confirmation cannot be sent."));
    const res = await call({ email: "new@example.com", send: true });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ changed: true, sent: null, sendError: expect.stringContaining("cancelled") });
    expect(m.update).toHaveBeenCalled();
  });

  it("a booking with no email cannot be sent to until one is entered; a missing booking is a 404", async () => {
    m.booking = { id: "b1", confirmationCode: "EBC-1", guestEmail: null, isDeleted: false };
    expect((await call({ send: true })).status).toBe(422);
    m.booking = null;
    expect((await call({ email: "new@example.com" })).status).toBe(404);
  });

  it("isEmail is strict enough for a customer address", () => {
    expect(isEmail("ana@example.com")).toBe(true);
    expect(isEmail("ana+trip@example.co.uk")).toBe(true);
    expect(isEmail("ana@example")).toBe(false);
    expect(isEmail("ana @example.com")).toBe(false);
  });
});
