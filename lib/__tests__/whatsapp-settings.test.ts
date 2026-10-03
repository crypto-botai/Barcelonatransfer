import { describe, it, expect } from "vitest";
import {
  AUTO_REPLY_COOLDOWN_MS, DEFAULT_SETTINGS, LIMITS, isOpenNow, pickAutoReply, sanitizeSettings, sitePath,
  type WhatsAppSettings,
} from "@/lib/whatsapp-settings";

/**
 * What the office can change, and what a browser is allowed to send.
 *
 * The settings page posts whatever its form holds, so these prove that nothing
 * odd survives: lengths are cut to what WhatsApp accepts, links stay on our own
 * site, and an automatic reply can never fire twice at the same customer.
 */

describe("sanitizeSettings", () => {
  it("returns the defaults for anything that is not an object", () => {
    for (const v of [null, undefined, "x", 5, []]) expect(sanitizeSettings(v)).toEqual(DEFAULT_SETTINGS);
  });

  it("cuts menu titles and descriptions to WhatsApp's limits", () => {
    const s = sanitizeSettings({ services: [{ id: "a", title: "T".repeat(80), description: "D".repeat(300), zone: "sitges" }] });
    expect(s.services[0].title).toHaveLength(LIMITS.title);
    expect(s.services[0].description).toHaveLength(LIMITS.description);
  });

  it("allows at most ten services, the most a WhatsApp list holds", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `s${i}`, title: `Service ${i}` }));
    expect(sanitizeSettings({ services: many }).services).toHaveLength(10);
  });

  it("drops a service with no name instead of sending Meta an empty row", () => {
    const s = sanitizeSettings({ services: [{ id: "a", title: "  " }, { id: "b", title: "Sitges" }] });
    expect(s.services.map((x) => x.id)).toEqual(["b"]);
  });

  it("gives duplicate ids their own, so two rows cannot answer to one tap", () => {
    const s = sanitizeSettings({ services: [{ id: "x", title: "One" }, { id: "x", title: "Two" }, { id: "x", title: "Three" }] });
    expect(new Set(s.services.map((x) => x.id)).size).toBe(3);
  });

  it("keeps links and pictures on our own site", () => {
    const s = sanitizeSettings({
      services: [
        { id: "a", title: "A", path: "https://evil.example/pay", image: "//evil.example/x.jpg" },
        { id: "b", title: "B", path: "javascript:alert(1)" },
        { id: "c", title: "C", path: "/transfers/sitges", image: "/whatsapp/sitges.jpg" },
      ],
    });
    expect(s.services[0].path).toBe("/book");
    expect(s.services[0].image.startsWith("/")).toBe(true);
    expect(s.services[0].image.startsWith("//")).toBe(false);
    expect(s.services[1].path).toBe("/book");
    expect(s.services[2]).toMatchObject({ path: "/transfers/sitges", image: "/whatsapp/sitges.jpg" });
  });

  it("accepts a typed price only when it is a sensible number", () => {
    const price = (v: unknown) => sanitizeSettings({ services: [{ id: "a", title: "A", manualFrom: v }] }).services[0].manualFrom;
    expect(price(55)).toBe(55);
    expect(price("49.5")).toBe(49.5);
    for (const bad of [0, -5, "abc", null, 1e9, NaN]) expect(price(bad)).toBeNull();
  });

  it("enables a service unless it was explicitly switched off", () => {
    const s = sanitizeSettings({ services: [{ id: "a", title: "A" }, { id: "b", title: "B", enabled: false }] });
    expect(s.services.map((x) => x.enabled)).toEqual([true, false]);
  });

  it("cleans saved replies: shortcut safe, empty ones gone, text limited", () => {
    const s = sanitizeSettings({
      quickReplies: [
        { shortcut: "/Price List!", text: "x".repeat(5000) },
        { shortcut: "", text: "no shortcut" },
        { shortcut: "empty", text: "   " },
      ],
    });
    expect(s.quickReplies).toHaveLength(1);
    expect(s.quickReplies[0].shortcut).toBe("price-list");
    expect(s.quickReplies[0].text).toHaveLength(LIMITS.replyText);
  });

  it("an empty list of saved replies is respected, not replaced by the defaults", () => {
    expect(sanitizeSettings({ quickReplies: [] }).quickReplies).toEqual([]);
  });

  it("automatic replies are off unless explicitly on, and keep default wording when blanked", () => {
    const s = sanitizeSettings({ welcome: { enabled: "yes", text: "" }, away: { enabled: true, text: "" } });
    expect(s.welcome.enabled).toBe(false); // "yes" is not true
    expect(s.welcome.text).toBe(DEFAULT_SETTINGS.welcome.text);
    expect(s.away.enabled).toBe(true);
    expect(s.away.text).toBe(DEFAULT_SETTINGS.away.text);
  });

  it("cleans opening hours: valid days, valid times", () => {
    const s = sanitizeSettings({ away: { hours: { days: [1, 1, 9, -1, "3", "x"], from: "25:00", to: "7:5" } } });
    expect(s.away.hours.days).toEqual([1, 3]);
    expect(s.away.hours.from).toBe(DEFAULT_SETTINGS.away.hours.from);
    expect(s.away.hours.to).toBe(DEFAULT_SETTINGS.away.hours.to);
  });

  it("email alerts stay on unless switched off", () => {
    expect(sanitizeSettings({}).emailAlerts).toBe(true);
    expect(sanitizeSettings({ emailAlerts: false }).emailAlerts).toBe(false);
  });

  it("is idempotent: cleaning twice changes nothing", () => {
    const once = sanitizeSettings({ services: [{ id: "a", title: "A", manualFrom: 40 }], welcome: { enabled: true, text: "Hi" } });
    expect(sanitizeSettings(once)).toEqual(once);
  });
});

describe("sitePath", () => {
  it.each(["/book", "/transfers/tossa-de-mar", "/a_b/c.d"])("accepts %s", (p) => expect(sitePath(p, "/x")).toBe(p));
  it.each(["book", "http://x.com", "//x.com", "/a b", "/a?x=1", "/<script>", "", null, undefined])("rejects %s", (p) => expect(sitePath(p, "/x")).toBe("/x"));
});

describe("isOpenNow (Barcelona time)", () => {
  const weekdays = { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" };
  // 2026-10-05 is a Monday. In October Barcelona is UTC+2.
  const at = (iso: string) => new Date(iso);

  it("is open inside the hours on an open day", () => {
    expect(isOpenNow(weekdays, at("2026-10-05T10:00:00Z"))).toBe(true); // 12:00 in Barcelona
  });

  it("uses Barcelona's clock, not UTC", () => {
    expect(isOpenNow(weekdays, at("2026-10-05T07:30:00Z"))).toBe(true);  // 09:30 Barcelona
    expect(isOpenNow(weekdays, at("2026-10-05T06:30:00Z"))).toBe(false); // 08:30 Barcelona
    expect(isOpenNow(weekdays, at("2026-10-05T16:30:00Z"))).toBe(false); // 18:30 Barcelona
  });

  it("is closed on a day that is not listed", () => {
    expect(isOpenNow(weekdays, at("2026-10-04T10:00:00Z"))).toBe(false); // Sunday
  });

  it("is closed at the closing minute and open at the opening one", () => {
    expect(isOpenNow(weekdays, at("2026-10-05T07:00:00Z"))).toBe(true);  // 09:00
    expect(isOpenNow(weekdays, at("2026-10-05T16:00:00Z"))).toBe(false); // 18:00
  });

  it("handles a shift that runs past midnight", () => {
    const night = { days: [5], from: "20:00", to: "04:00" }; // Fridays
    expect(isOpenNow(night, at("2026-10-09T19:00:00Z"))).toBe(true);  // Fri 21:00
    expect(isOpenNow(night, at("2026-10-09T23:00:00Z"))).toBe(true);  // Sat 01:00, still Friday's shift
    expect(isOpenNow(night, at("2026-10-10T03:00:00Z"))).toBe(false); // Sat 05:00
    expect(isOpenNow(night, at("2026-10-05T19:00:00Z"))).toBe(false); // a Monday
  });

  it("treats the same opening and closing time as open all day", () => {
    expect(isOpenNow({ days: [1], from: "00:00", to: "00:00" }, at("2026-10-05T21:59:00Z"))).toBe(true);
  });

  it("follows the clock change at the end of October", () => {
    // 2026-11-02 is a Monday; Barcelona is UTC+1 by then.
    expect(isOpenNow(weekdays, at("2026-11-02T08:30:00Z"))).toBe(true);  // 09:30
    expect(isOpenNow(weekdays, at("2026-11-02T07:30:00Z"))).toBe(false); // 08:30
  });
});

describe("pickAutoReply", () => {
  const base: WhatsAppSettings = {
    ...DEFAULT_SETTINGS,
    welcome: { enabled: true, text: "Welcome" },
    away: { enabled: true, text: "We are closed", hours: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" } },
  };
  const OPEN = new Date("2026-10-05T10:00:00Z");   // Monday 12:00 Barcelona
  const CLOSED = new Date("2026-10-05T20:00:00Z"); // Monday 22:00 Barcelona
  const ago = (ms: number, from: Date) => new Date(from.getTime() - ms);

  it("sends nothing when both are off", () => {
    expect(pickAutoReply({ settings: DEFAULT_SETTINGS, now: CLOSED, lastOutboundAt: null, lastAutoAt: null })).toBeNull();
  });

  it("sends the away message outside hours, and prefers it to the welcome", () => {
    expect(pickAutoReply({ settings: base, now: CLOSED, lastOutboundAt: null, lastAutoAt: null })).toEqual({ kind: "away", text: "We are closed" });
  });

  it("sends the welcome inside hours to a customer we have not written to", () => {
    expect(pickAutoReply({ settings: base, now: OPEN, lastOutboundAt: null, lastAutoAt: null })).toEqual({ kind: "welcome", text: "Welcome" });
  });

  it("does not send the away message twice in twelve hours", () => {
    const recent = ago(AUTO_REPLY_COOLDOWN_MS - 60_000, CLOSED);
    expect(pickAutoReply({ settings: base, now: CLOSED, lastOutboundAt: recent, lastAutoAt: recent })).toBeNull();
  });

  it("sends it again once twelve hours have passed", () => {
    const old = ago(AUTO_REPLY_COOLDOWN_MS + 60_000, CLOSED);
    expect(pickAutoReply({ settings: base, now: CLOSED, lastOutboundAt: old, lastAutoAt: old })?.kind).toBe("away");
  });

  it("leaves a conversation alone when a person wrote recently", () => {
    expect(pickAutoReply({ settings: base, now: OPEN, lastOutboundAt: ago(30 * 60_000, OPEN), lastAutoAt: null })).toBeNull();
  });

  it("a person's reply during the night does not trigger the away message again either", () => {
    // Away already sent 2 hours ago; a person replied 1 hour ago. Neither is due.
    expect(pickAutoReply({ settings: base, now: CLOSED, lastOutboundAt: ago(3_600_000, CLOSED), lastAutoAt: ago(7_200_000, CLOSED) })).toBeNull();
  });

  it("does not send the welcome when only the away message is on and the office is open", () => {
    const awayOnly = { ...base, welcome: { enabled: false, text: "x" } };
    expect(pickAutoReply({ settings: awayOnly, now: OPEN, lastOutboundAt: null, lastAutoAt: null })).toBeNull();
  });
});
