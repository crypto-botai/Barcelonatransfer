import { describe, it, expect } from "vitest";
import { toE164, isDialable, telHref, waHref, displayPhone } from "@/lib/phone";
import { newLeadCard } from "@/lib/email/premium";

/**
 * A lead you cannot ring is not a lead.
 *
 * The booking form has a country picker and emits E.164, but the session
 * endpoint that records a lead accepts any string, and what arrived was
 * mixed: "+17025386800" beside "2036230511" and "14033489766". The alert
 * built its WhatsApp link as wa.me/<digits>, so a number with no dialling
 * code produced a link to nothing that fails silently when tapped — which
 * looks exactly like a reachable lead until somebody tries.
 */

describe("what counts as a number", () => {
  it("keeps one that already carries its country", () => {
    expect(toE164("+17025386800")).toBe("+17025386800");
    expect(toE164("+34 630 788 095")).toBe("+34630788095");
    expect(toE164("+34-630-788-095")).toBe("+34630788095");
  });

  /** "00" is the international prefix across Europe and means the same thing. */
  it("converts a 00 prefix", () => {
    expect(toE164("0034630788095")).toBe("+34630788095");
    expect(toE164("00 1 702 538 6800")).toBe("+17025386800");
  });

  /**
   * Nothing here guesses. A bare ten-digit number could be almost anywhere,
   * and a wrong guess dials a stranger while hiding that the lead was never
   * reachable.
   */
  it("refuses to invent a country code", () => {
    expect(toE164("2036230511")).toBeNull();
    expect(toE164("14033489766")).toBeNull();
    expect(toE164("630788095")).toBeNull();
  });

  it("rejects what is not a number at all", () => {
    expect(toE164("54545544")).toBeNull();   // the junk entry
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164("+123")).toBeNull();        // too short to be international
    expect(toE164("+1234567890123456")).toBeNull(); // past E.164's fifteen
  });
});

describe("the links built from it", () => {
  it("offers WhatsApp only when the number is genuinely international", () => {
    expect(waHref("+34630788095")).toBe("https://wa.me/34630788095");
    // wa.me resolves a malformed number to nothing, so no link is better
    // than one that looks like a way to reach somebody and is not.
    expect(waHref("2036230511")).toBeNull();
    expect(waHref("54545544")).toBeNull();
  });

  it("still offers to dial a local number, for whoever is in that country", () => {
    expect(telHref("2036230511")).toBe("tel:2036230511");
    expect(telHref("+34630788095")).toBe("tel:+34630788095");
    expect(telHref("123")).toBeNull();
  });

  it("says which numbers can actually be rung from here", () => {
    expect(isDialable("+34630788095")).toBe(true);
    expect(isDialable("2036230511")).toBe(false);
  });

  it("shows the number as given when it cannot be normalised", () => {
    expect(displayPhone("2036230511")).toEqual({ text: "2036230511", dialable: false });
    expect(displayPhone("+34 630 788 095")).toEqual({ text: "+34630788095", dialable: true });
    expect(displayPhone(null).text).toBe("—");
  });
});

describe("the lead alert", () => {
  const lead = (phone: string) => newLeadCard({
    name: "Zachary Trageton", email: "z@example.com", phone,
    pickup: "Terminal 1", dropoff: "Hotel Arts", when: "2026-09-28 10:00", passengers: 2,
  });

  it("offers both ways to reach a proper number", () => {
    const html = lead("+17025386800");
    expect(html).toContain("tel:+17025386800");
    expect(html).toContain("https://wa.me/17025386800");
    expect(html).toContain("Call The Guest");
    expect(html).toContain("Message on WhatsApp");
  });

  /** The failure that started this: a link that looks fine and reaches nobody. */
  it("does not offer WhatsApp for a number with no country code", () => {
    const html = lead("2036230511");
    expect(html).not.toContain("wa.me/2036230511");
    expect(html).not.toContain("Message on WhatsApp");
    // And says why, rather than leaving the office to find out by calling.
    expect(html).toContain("no country code");
  });

  it("says plainly when there is no number worth trying", () => {
    const html = lead("54545544");
    expect(html).toContain("no country code");
    expect(html).not.toContain("wa.me/54545544");
  });
});
