import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  parseBookingMeta,
  stripMeta,
  formatExtras,
  formatExtraLine,
} from "@/lib/booking-meta";

/**
 * Extras have to reach the people who act on them.
 *
 * They are stored inside a `[META]{…}[/META]` block on specialRequests, and
 * nothing read them back: the admin drawer parsed the block but used only
 * `bookingType`, while the admin alert and the driver assignment email both
 * stripped it with a regex and kept the leftover text. A customer could pay €5
 * for a baby seat and neither the office nor the driver was ever told.
 */

const REAL = '[META]{"bookingType":"TRANSFER","durationHours":null,'
  + '"extras":[{"id":"baby_seat","label":"Baby Seat","price":5,"quantity":2},'
  + '{"id":"name_board","label":"Name Board Sign","price":5,"quantity":1}],'
  + '"extrasCost":15,"memberTier":"Silver"}[/META]\nPlease call on arrival.';

describe("parseBookingMeta", () => {
  it("reads the extras a customer paid for", () => {
    const m = parseBookingMeta(REAL);
    expect(m.extras).toHaveLength(2);
    expect(m.extras[0]).toMatchObject({ id: "baby_seat", quantity: 2, price: 5 });
    expect(m.extrasCost).toBe(15);
  });

  it("keeps the customer's own note and drops the block", () => {
    expect(parseBookingMeta(REAL).notes).toBe("Please call on arrival.");
  });

  it("reads the booking type and tier", () => {
    const m = parseBookingMeta(REAL);
    expect(m.bookingType).toBe("TRANSFER");
    expect(m.memberTier).toBe("Silver");
  });

  it("takes the label from the catalogue, not from the stored string", () => {
    // A booking made before a product was renamed should still read correctly.
    const stale = '[META]{"extras":[{"id":"meet_greet","label":"Old Name","price":5,"quantity":1}]}[/META]';
    expect(parseBookingMeta(stale).extras[0].label).toBe("Meet & Greet");
  });

  it("keeps an unrecognised extra rather than dropping it", () => {
    // Losing something the customer paid for is worse than an odd label.
    const odd = '[META]{"extras":[{"id":"custom_thing","label":"Champagne","price":30,"quantity":1}]}[/META]';
    const m = parseBookingMeta(odd);
    expect(m.extras).toHaveLength(1);
    expect(m.extras[0].label).toBe("Champagne");
  });

  it("survives a malformed block without losing the note", () => {
    const broken = "[META]{not json[/META]\nMy note";
    const m = parseBookingMeta(broken);
    expect(m.extras).toEqual([]);
    expect(m.notes).toBe("My note");
  });

  it("handles a booking with no metadata at all", () => {
    const m = parseBookingMeta("Just a plain note");
    expect(m.extras).toEqual([]);
    expect(m.notes).toBe("Just a plain note");
  });

  it("handles null and empty input", () => {
    for (const v of [null, undefined, ""]) {
      const m = parseBookingMeta(v as string | null | undefined);
      expect(m.extras).toEqual([]);
      expect(m.notes).toBeNull();
    }
  });

  it("ignores a non-array extras value", () => {
    expect(parseBookingMeta('[META]{"extras":"nope"}[/META]').extras).toEqual([]);
  });

  it("defaults a missing quantity to one rather than zero", () => {
    const m = parseBookingMeta('[META]{"extras":[{"id":"child_seat"}]}[/META]');
    expect(m.extras[0].quantity).toBe(1);
    expect(m.extras[0].price).toBe(5);
  });
});

describe("stripMeta", () => {
  it("returns null when the note was only metadata", () => {
    expect(stripMeta('[META]{"extras":[]}[/META]')).toBeNull();
  });
});

describe("formatting", () => {
  it("shows quantity and line total", () => {
    expect(formatExtraLine({ id: "baby_seat", label: "Baby Seat", price: 5, quantity: 2 }))
      .toBe("Baby Seat ×2 — €10.00");
  });

  it("omits the multiplier for a single item", () => {
    expect(formatExtraLine({ id: "meet_greet", label: "Meet & Greet", price: 5, quantity: 1 }))
      .toBe("Meet & Greet — €5.00");
  });

  it('reads a waived extra as "included", not €0', () => {
    // Gold members get meet & greet free; "€0.00" would look like a bug.
    expect(formatExtraLine({ id: "meet_greet", label: "Meet & Greet", price: 0, quantity: 1 }))
      .toBe("Meet & Greet — included");
  });

  it("joins several extras onto one line", () => {
    expect(formatExtras(parseBookingMeta(REAL).extras))
      .toBe("Baby Seat ×2 — €10.00, Name Board Sign — €5.00");
  });
});

describe("every surface that shows a booking reads the extras", () => {
  // The regression: these each stripped the block and showed only the note.
  const SURFACES = [
    "app/admin/bookings/page.tsx",
    "lib/resend.ts",
  ];

  it.each(SURFACES)("%s uses the shared parser", (file) => {
    const src = fs.readFileSync(file, "utf8");
    expect(src, `${file} should import from lib/booking-meta`).toMatch(/booking-meta/);
  });

  it("no surface strips the block with its own regex any more", () => {
    for (const file of SURFACES) {
      const src = fs.readFileSync(file, "utf8");
      const strips = src.match(/replace\(\/\\\[META\\\]/g) ?? [];
      expect(strips, `${file} still strips [META] by hand — use stripMeta/parseBookingMeta`).toEqual([]);
    }
  });

  it("the driver email names the extras it must bring", () => {
    const src = fs.readFileSync("lib/resend.ts", "utf8");
    expect(src).toMatch(/Extras to bring/);
  });
});
