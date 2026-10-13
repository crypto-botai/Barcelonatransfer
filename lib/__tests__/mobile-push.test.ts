import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ devices: [] as Row[], deleted: [] as string[], deletedIds: [] as string[], logs: [] as Row[], missingTable: false }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mobileDevice: {
      findMany: async ({ where }: { where: { userId: string } }) => {
        if (db.missingTable) throw new Error("relation does not exist");
        return db.devices.filter((d) => d.userId === where.userId);
      },
      deleteMany: async ({ where }: { where: { token?: { in: string[] }; id?: { in: string[] } } }) => {
        if (where.token) { db.deleted.push(...where.token.in); return { count: where.token.in.length }; }
        db.deletedIds.push(...(where.id?.in ?? [])); return { count: where.id?.in.length ?? 0 };
      },
    },
    activityLog: {
      create: async ({ data }: { data: Row }) => { db.logs.push({ id: `log${db.logs.length + 1}`, createdAt: new Date(), ...data }); return data; },
      findMany: async ({ where }: { where: { action: string; createdAt: { gte: Date; lte: Date } } }) =>
        db.logs.filter((l) => l.action === where.action && (l.createdAt as Date) <= where.createdAt.lte && (l.createdAt as Date) >= where.createdAt.gte),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => { Object.assign(db.logs.find((l) => l.id === where.id)!, data); return data; },
    },
  },
}));

import { MOBILE_EVENTS, PUSH_CHECKED_ACTION, PUSH_SENT_ACTION, resetPushSweepThrottle, sendMobilePushToUser, sweepMobilePushReceipts } from "@/lib/notifications/mobile-push";

const msg = { title: "Your driver is on the way", body: "Omar", data: { event: "DRIVER_EN_ROUTE", bookingId: "b1" } };
const tok = (n: number) => `ExponentPushToken[token-number-${n}-xxxxxxxx]`;
const reply = (tickets: unknown[], ok = true) => (async () => ({ ok, json: async () => ({ data: tickets }) })) as unknown as typeof fetch;

beforeEach(() => {
  db.devices.length = 0;
  db.deleted.length = 0;
  db.deletedIds.length = 0;
  db.logs.length = 0;
  db.missingTable = false;
  resetPushSweepThrottle();
  vi.restoreAllMocks();
  delete process.env.EXPO_ACCESS_TOKEN;
});

describe("push to the mobile apps", () => {
  it("sends one message per registered phone, with only identifiers in the data", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) }, { id: "d2", userId: "u1", token: tok(2) }, { id: "d3", userId: "u2", token: tok(3) });
    let body: Row[] = [];
    const f = (async (_u: string, init: { body: string }) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }) }; }) as unknown as typeof fetch;
    const r = await sendMobilePushToUser("u1", msg, f, 0);
    expect(r).toEqual({ sent: 2, failed: 0 });
    expect(body.map((m) => m.to)).toEqual([tok(1), tok(2)]);
    expect(body[0].data).toEqual({ event: "DRIVER_EN_ROUTE", bookingId: "b1" });
    expect(body[0].collapseId).toBe("b1:DRIVER_EN_ROUTE");
    expect(JSON.stringify(body)).not.toMatch(/phone|price|address|@/i);
  });

  it("removes a token the service says is dead, and keeps the rest", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) }, { id: "d2", userId: "u1", token: tok(2) });
    const r = await sendMobilePushToUser("u1", msg, reply([{ status: "error", details: { error: "DeviceNotRegistered" } }, { status: "ok" }]));
    expect(r).toEqual({ sent: 1, failed: 1 });
    expect(db.deleted).toEqual([tok(1)]);
  });

  it("a person with no phone registered is skipped, not an error", async () => {
    expect(await sendMobilePushToUser("nobody", msg, reply([]))).toEqual({ sent: 0, failed: 0, skipped: "no mobile devices" });
  });

  it("never throws: an unreachable service, a bad answer, or a database without the table", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await sendMobilePushToUser("u1", msg, down, 0)).toEqual({ sent: 0, failed: 1 });
    expect(await sendMobilePushToUser("u1", msg, reply([], false), 0)).toEqual({ sent: 0, failed: 1 });
    db.missingTable = true;
    expect((await sendMobilePushToUser("u1", msg, reply([]))).skipped).toBe("no mobile devices table");
  });

  it("uses the access token only when one is configured", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    let headers: Record<string, string> = {};
    const f = (async (_u: string, init: { headers: Record<string, string> }) => { headers = init.headers; return { ok: true, json: async () => ({ data: [{ status: "ok" }] }) }; }) as unknown as typeof fetch;
    await sendMobilePushToUser("u1", msg, f);
    expect(headers.Authorization).toBeUndefined();
    process.env.EXPO_ACCESS_TOKEN = "test-token";
    await sendMobilePushToUser("u1", msg, f);
    expect(headers.Authorization).toBe("Bearer test-token");
  });
});

describe("delivery you can see and rely on", () => {
  const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("retries once when the service is busy or briefly down, then succeeds", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    let calls = 0;
    const f = (async () => { calls += 1; return calls === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ data: [{ status: "ok", id: "t1" }] }) }; }) as unknown as typeof fetch;
    expect(await sendMobilePushToUser("u1", msg, f, 0)).toEqual({ sent: 1, failed: 0 });
    expect(calls).toBe(2);
  });

  it("does not retry a refusal that will not change (a 4xx)", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    let calls = 0;
    const f = (async () => { calls += 1; return { ok: false, status: 400, json: async () => ({}) }; }) as unknown as typeof fetch;
    const warn = quiet();
    expect(await sendMobilePushToUser("u1", msg, f, 0)).toEqual({ sent: 0, failed: 1 });
    expect(calls).toBe(1);
    expect(warn).toHaveBeenCalled();
  });

  it("logs Expo's error codes, never a push token", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    const warn = quiet();
    await sendMobilePushToUser("u1", msg, reply([{ status: "error", message: `bad ${tok(1)}`, details: { error: "InvalidCredentials" } }]), 0);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("InvalidCredentials");
    expect(logged).not.toContain("ExponentPushToken");
    expect(logged).not.toContain("token-number-1");
  });

  it("keeps the ticket ids (and device ids, not tokens) so receipts can be read later", async () => {
    db.devices.push({ id: "d1", userId: "u1", token: tok(1) });
    await sendMobilePushToUser("u1", msg, reply([{ status: "ok", id: "ticket-1" }]), 0);
    expect(db.logs).toHaveLength(1);
    expect(db.logs[0].action).toBe(PUSH_SENT_ACTION);
    expect(db.logs[0].details).toEqual({ event: "DRIVER_EN_ROUTE", tickets: [{ id: "ticket-1", deviceId: "d1" }] });
    expect(JSON.stringify(db.logs)).not.toContain("ExponentPushToken");
  });

  it("reads receipts later: a dead phone is removed and a credential error is reported by code", async () => {
    const old = new Date(Date.now() - 20 * 60_000);
    db.logs.push({ id: "log1", action: PUSH_SENT_ACTION, createdAt: old, details: { event: "DRIVER_NEW_JOB", tickets: [{ id: "t1", deviceId: "d1" }, { id: "t2", deviceId: "d2" }, { id: "t3", deviceId: "d3" }] } });
    const warn = quiet();
    let asked: string[] = [];
    const f = (async (_u: string, init: { body: string }) => {
      asked = JSON.parse(init.body).ids;
      return { ok: true, status: 200, json: async () => ({ data: { t1: { status: "ok" }, t2: { status: "error", details: { error: "DeviceNotRegistered" } }, t3: { status: "error", details: { error: "InvalidCredentials" } } } }) };
    }) as unknown as typeof fetch;
    const r = await sweepMobilePushReceipts(f);
    expect(asked).toEqual(["t1", "t2", "t3"]);
    expect(r).toEqual({ checked: 3, errors: { DeviceNotRegistered: 1, InvalidCredentials: 1 }, removedDevices: 1 });
    expect(db.deletedIds).toEqual(["d2"]);
    expect(db.logs[0].action).toBe(PUSH_CHECKED_ACTION);
    expect(JSON.stringify(warn.mock.calls)).toContain("InvalidCredentials");
  });

  it("leaves very recent sends alone (their receipts are not ready) and never reads a row twice", async () => {
    db.logs.push({ id: "log1", action: PUSH_SENT_ACTION, createdAt: new Date(), details: { tickets: [{ id: "t1", deviceId: "d1" }] } });
    let calls = 0;
    const f = (async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ data: {} }) }; }) as unknown as typeof fetch;
    expect((await sweepMobilePushReceipts(f)).checked).toBe(0);
    expect(calls).toBe(0);
    expect(db.logs[0].action).toBe(PUSH_SENT_ACTION);
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
