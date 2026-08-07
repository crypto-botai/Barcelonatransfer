import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
const deleted: string[][] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany:   vi.fn(async () => subs),
      deleteMany: vi.fn(async ({ where }: any) => { deleted.push(where.id.in); return { count: where.id.in.length }; }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...a: unknown[]) => sendNotification(...a),
  },
}));

/** web-push rejects with an error carrying statusCode. */
function pushError(statusCode: number) {
  return Object.assign(new Error(`push ${statusCode}`), { statusCode });
}

describe("sendPushToUser", () => {
  beforeEach(() => {
    subs.length = 0;
    deleted.length = 0;
    sendNotification.mockReset();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("skips cleanly when VAPID keys are absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "t", body: "b" });
    expect(r.skipped).toMatch(/not configured/);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips when the user has no registered devices", async () => {
    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "t", body: "b" });
    expect(r.skipped).toMatch(/no registered devices/);
  });

  it("sends to every registered device", async () => {
    subs.push(
      { id: "s1", endpoint: "https://push.example/1", p256dh: "k1", auth: "a1" },
      { id: "s2", endpoint: "https://push.example/2", p256dh: "k2", auth: "a2" },
    );
    sendNotification.mockResolvedValue({});
    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "Booking confirmed", body: "b", url: "/x" });
    expect(r.sent).toBe(2);
    expect(r.failed).toBe(0);
    // Payload is JSON the service worker parses.
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string)).toMatchObject({
      title: "Booking confirmed", url: "/x",
    });
  });

  it("prunes expired endpoints instead of counting them as failures", async () => {
    subs.push(
      { id: "live", endpoint: "https://push.example/live", p256dh: "k", auth: "a" },
      { id: "gone", endpoint: "https://push.example/gone", p256dh: "k", auth: "a" },
    );
    sendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(pushError(410));   // Gone

    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "t", body: "b" });

    expect(r.sent).toBe(1);
    expect(r.pruned).toBe(1);
    expect(r.failed).toBe(0);
    expect(deleted.flat()).toEqual(["gone"]);
  });

  it("treats 404 the same as 410", async () => {
    subs.push({ id: "dead", endpoint: "https://push.example/dead", p256dh: "k", auth: "a" });
    sendNotification.mockRejectedValue(pushError(404));
    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "t", body: "b" });
    expect(r.pruned).toBe(1);
    expect(deleted.flat()).toEqual(["dead"]);
  });

  it("counts a real server error as failed and keeps the subscription", async () => {
    subs.push({ id: "s1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" });
    sendNotification.mockRejectedValue(pushError(500));
    const { sendPushToUser } = await import("@/lib/notifications/push");
    const r = await sendPushToUser("u1", { title: "t", body: "b" });
    expect(r.failed).toBe(1);
    expect(r.pruned).toBe(0);
    expect(deleted).toHaveLength(0);   // a 500 is transient; do not delete
  });

  it("never throws, whatever the push service does", async () => {
    subs.push({ id: "s1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" });
    sendNotification.mockRejectedValue(new Error("no statusCode at all"));
    const { sendPushToUser } = await import("@/lib/notifications/push");
    await expect(sendPushToUser("u1", { title: "t", body: "b" })).resolves.toBeDefined();
  });
});
