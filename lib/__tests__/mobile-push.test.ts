import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ devices: [] as Row[], deleted: [] as string[], missingTable: false }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mobileDevice: {
      findMany: async ({ where }: { where: { userId: string } }) => {
        if (db.missingTable) throw new Error("relation does not exist");
        return db.devices.filter((d) => d.userId === where.userId);
      },
      deleteMany: async ({ where }: { where: { token: { in: string[] } } }) => { db.deleted.push(...where.token.in); return { count: where.token.in.length }; },
    },
  },
}));

import { MOBILE_EVENTS, sendMobilePushToUser } from "@/lib/notifications/mobile-push";

const msg = { title: "Your driver is on the way", body: "Omar", data: { event: "DRIVER_EN_ROUTE", bookingId: "b1" } };
const tok = (n: number) => `ExponentPushToken[token-number-${n}-xxxxxxxx]`;
const reply = (tickets: unknown[], ok = true) => (async () => ({ ok, json: async () => ({ data: tickets }) })) as unknown as typeof fetch;

beforeEach(() => {
  db.devices.length = 0;
  db.deleted.length = 0;
  db.missingTable = false;
  delete process.env.EXPO_ACCESS_TOKEN;
});

describe("push to the mobile apps", () => {
  it("sends one message per registered phone, with only identifiers in the data", async () => {
    db.devices.push({ userId: "u1", token: tok(1) }, { userId: "u1", token: tok(2) }, { userId: "u2", token: tok(3) });
    let body: Row[] = [];
    const f = (async (_u: string, init: { body: string }) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }) }; }) as unknown as typeof fetch;
    const r = await sendMobilePushToUser("u1", msg, f);
    expect(r).toEqual({ sent: 2, failed: 0 });
    expect(body.map((m) => m.to)).toEqual([tok(1), tok(2)]);
    expect(body[0].data).toEqual({ event: "DRIVER_EN_ROUTE", bookingId: "b1" });
    expect(body[0].collapseId).toBe("b1:DRIVER_EN_ROUTE");
    expect(JSON.stringify(body)).not.toMatch(/phone|price|address|@/i);
  });

  it("removes a token the service says is dead, and keeps the rest", async () => {
    db.devices.push({ userId: "u1", token: tok(1) }, { userId: "u1", token: tok(2) });
    const r = await sendMobilePushToUser("u1", msg, reply([{ status: "error", details: { error: "DeviceNotRegistered" } }, { status: "ok" }]));
    expect(r).toEqual({ sent: 1, failed: 1 });
    expect(db.deleted).toEqual([tok(1)]);
  });

  it("a person with no phone registered is skipped, not an error", async () => {
    expect(await sendMobilePushToUser("nobody", msg, reply([]))).toEqual({ sent: 0, failed: 0, skipped: "no mobile devices" });
  });

  it("never throws: an unreachable service, a bad answer, or a database without the table", async () => {
    db.devices.push({ userId: "u1", token: tok(1) });
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await sendMobilePushToUser("u1", msg, down)).toEqual({ sent: 0, failed: 1 });
    expect(await sendMobilePushToUser("u1", msg, reply([], false))).toEqual({ sent: 0, failed: 1 });
    db.missingTable = true;
    expect((await sendMobilePushToUser("u1", msg, reply([]))).skipped).toBe("no mobile devices table");
  });

  it("uses the access token only when one is configured", async () => {
    db.devices.push({ userId: "u1", token: tok(1) });
    let headers: Record<string, string> = {};
    const f = (async (_u: string, init: { headers: Record<string, string> }) => { headers = init.headers; return { ok: true, json: async () => ({ data: [{ status: "ok" }] }) }; }) as unknown as typeof fetch;
    await sendMobilePushToUser("u1", msg, f);
    expect(headers.Authorization).toBeUndefined();
    process.env.EXPO_ACCESS_TOKEN = "test-token";
    await sendMobilePushToUser("u1", msg, f);
    expect(headers.Authorization).toBe("Bearer test-token");
  });
});

describe("which moments reach the apps", () => {
  it("covers the customer and driver moments and nothing the office sees", () => {
    for (const e of ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "RIDE_COMPLETED", "BOOKING_CANCELLED", "DRIVER_NEW_JOB", "DRIVER_JOB_CANCELLED"]) expect(MOBILE_EVENTS.has(e), e).toBe(true);
    for (const e of ["NEW_LEAD", "BOOKING_CONFIRMED_ADMIN", "OFFICE_MESSAGE"]) expect(MOBILE_EVENTS.has(e), e).toBe(false);
  });

  it("notify() sends it once per event, to a known user, before the audit", () => {
    const src = readFileSync(join(__dirname, "..", "..", "lib", "notifications", "service.ts"), "utf8");
    const mobile = src.indexOf("sendMobilePushToUser(input.userId");
    expect(mobile).toBeGreaterThan(0);
    expect(mobile).toBeLessThan(src.indexOf("await audit(input, results, title)"));
    expect(src).toContain("MOBILE_EVENTS.has(input.event) && (!input.channels || input.channels.includes(\"push\"))");
  });
});
