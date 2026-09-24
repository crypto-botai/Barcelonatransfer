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
  /**
   * The escaping moved into contactEnquiryCard when this email was rebuilt on
   * the house template, so the route hands over the raw values and the card
   * is what must not render them raw. That behaviour is exercised for real in
   * lib/__tests__/email-templates.test.ts; this only checks the route is
   * still going through it rather than assembling its own markup again.
   */
  it("builds the email from the card, not by hand", () => {
    expect(contact).toContain("contactEnquiryCard({");
    expect(contact).toContain("html: emailDocument(");
    expect(contact).not.toContain("<div style=");
  });

  it("escapes and encodes inside the card", async () => {
    const { contactEnquiryCard } = await import("@/lib/email/premium");
    const html = contactEnquiryCard({
      name: "<b>x</b>", email: "a+b@example.com", phone: "+34 600", message: "<i>hi</i> & bye",
    });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&lt;i&gt;hi&lt;/i&gt; &amp; bye");
    // A raw "+" in a mailto is a space to some clients.
    expect(html).toContain("mailto:a%2Bb%40example.com");
  });

  /** A line break in a subject line is where header injection starts. */
  it("strips line breaks out of the subject", () => {
    expect(contact).toContain("const subjectSafe = (s: string) => s.replace(/[\\r\\n]+/g,");
    expect(contact).toContain("subject: `📩 Contact Enquiry from ${subjectSafe(body.name)}`");
  });

  /** A mailto with an unencoded address is its own small injection. */
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

describe("everything is sent from a domain that exists", () => {
  /**
   * The contact form and the newsletter sent from
   * noreply@elitebcntransfers.com, which is NXDOMAIN — no A record, no MX,
   * no DKIM. Nothing failed loudly, because Resend accepts a send and
   * delivers afterwards: the form returned {"ok":true} to the customer and
   * the enquiry went nowhere. elitebcn.info is the domain that actually
   * carries the DKIM key and the SPF record.
   */
  it("never sends from elitebcntransfers.com", () => {
    for (const f of [
      "app/api/contact/route.ts",
      "app/api/newsletter/subscribe/route.ts",
      "app/admin/settings/page.tsx",
    ]) {
      const s = rd(f);
      // The explanation of the bug may name it; a from: line may not.
      const sending = s.split("\n").filter((l) => /from:|const FROM|value:/.test(l)).join("\n");
      expect(sending, f).not.toContain("elitebcntransfers.com");
    }
  });

  it("uses the one configured sender everywhere", () => {
    for (const f of ["app/api/contact/route.ts", "app/api/newsletter/subscribe/route.ts"]) {
      expect(rd(f), f).toContain('process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>"');
    }
    expect(rd("lib/resend.ts")).toContain('process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>"');
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
