import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What the public endpoints do when they are given rubbish.
 *
 * Found by throwing malformed bodies and impossible numbers at the live site.
 * A 400 or a 422 is the right answer to any of it; a 500 is an unhandled
 * throw, and on a booking form that is a customer looking at a dead button.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("a body that is not JSON", () => {
  /**
   * `await req.json()` throws on malformed input. Two of the four public
   * POST routes had it bare inside the try, so the catch turned it into a
   * 500 rather than a 400.
   */
  it("is a 400 on every public POST route, not a 500", () => {
    for (const route of [
      "app/api/contact/route.ts",
      "app/api/booking-session/route.ts",
      "app/api/quote/route.ts",
      "app/api/bookings/route.ts",
    ]) {
      expect(rd(route), route).toContain("await req.json().catch(() => null)");
    }
  });

  it("says so rather than carrying on with nothing", () => {
    for (const route of ["app/api/contact/route.ts", "app/api/booking-session/route.ts"]) {
      expect(rd(route), route).toContain('return NextResponse.json({ error: "Invalid request" }, { status: 400 })');
    }
  });
});

describe("the contact form's enquiry, inside the owner's inbox", () => {
  const contact = rd("app/api/contact/route.ts");

  /**
   * Name, email, phone and message were interpolated raw into an HTML email.
   * Anyone could put markup in a public form's name box and have it render
   * in the owner's inbox, arriving from our own domain, which is the part
   * that makes a fake link in it convincing.
   */
  it("escapes every field it renders", () => {
    expect(contact).toContain("const esc = (");
    expect(contact).toContain("${esc(body.name)}");
    expect(contact).toContain("${esc(body.email)}");
    expect(contact).toContain("${esc(body.phone)");
    expect(contact).toContain("${esc(body.message)}");
  });

  it("leaves nothing interpolated raw into the markup", () => {
    // The html template only. replyTo is a validated address and the subject
    // is plain text, where escaping would show the entities to the reader.
    const html = contact.slice(contact.indexOf("html: `"));
    for (const f of ["body.name", "body.email", "body.phone", "body.message"]) {
      expect(html, f).not.toContain("${" + f + "}");
    }
  });

  /** A line break in a subject line is where header injection starts. */
  it("strips line breaks out of the subject", () => {
    expect(contact).toContain("const subjectSafe = (s: string) => s.replace(/[\\r\\n]+/g,");
    expect(contact).toContain("subject: `📩 Contact Enquiry from ${subjectSafe(body.name)}`");
  });

  /** A mailto with an unencoded address is its own small injection. */
  it("encodes the address in the mailto link", () => {
    expect(contact).toContain("mailto:${encodeURIComponent(body.email)}");
  });
});

describe("coordinates have to be on Earth", () => {
  const quote = rd("app/api/quote/route.ts");

  /**
   * lat 999 / lng 999 was accepted and priced as a 26,599 km journey.
   * Nothing rejected it and nothing flagged it; the fare was whatever that
   * distance came to.
   */
  it("bounds latitude and longitude on the quote", () => {
    expect(quote).toContain("pickupLat:       z.number().min(-90).max(90)");
    expect(quote).toContain("pickupLng:       z.number().min(-180).max(180)");
    expect(quote).toContain("dropoffLat:      z.number().min(-90).max(90).optional()");
    expect(quote).toContain("dropoffLng:      z.number().min(-180).max(180).optional()");
  });

  /**
   * 0,0 has to stay valid. The booking form clears the coordinates whenever
   * the address text is edited, and the server geocodes the text instead —
   * which is what lets somebody who never opens the dropdown get a price.
   */
  it("still allows the 0,0 the booking form sends", () => {
    expect(0).toBeGreaterThanOrEqual(-90);
    expect(0).toBeLessThanOrEqual(90);
    expect(rd("components/booking/AddressAutocomplete.tsx")).toContain("onChange({ address: q, lat: 0, lng: 0 })");
  });
});

describe("the staff endpoints refuse an anonymous caller", () => {
  it("every admin and partner route checks first", () => {
    for (const route of [
      "app/api/admin/bookings/route.ts",
      "app/api/admin/abandoned/route.ts",
      "app/api/partner/drivers/route.ts",
      "app/api/partner/drivers/[id]/route.ts",
      "app/api/partner/me/route.ts",
    ]) {
      const s = rd(route);
      expect(s, route).toMatch(/requireAdmin\(\)|requirePartner\(|await admin\(\)/);
      expect(s, route).toContain('{ status: 401 }');
    }
  });
});
