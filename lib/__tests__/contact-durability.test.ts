import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A delivery problem must cost the notification, not the enquiry.
 *
 * The contact form sent an email and did nothing else. On 27 Sept, with
 * Resend pointed at a key that production could not see, the send threw, the
 * route returned 500, and the message the customer had typed was gone. They
 * saw a dead button; the office never learned anyone had written. That is the
 * same failure that lost fifteen booking leads, one form along — work that
 * depended on an email getting through, with nothing written down first.
 *
 * The enquiry is now stored before the send is attempted. These tests hold
 * the ordering and the two outcomes, because the difference between them is
 * the whole point: a send that fails after a successful store is recoverable
 * and the customer should not be asked to type it again; a send that fails
 * with nothing stored really is lost and must not report success.
 */

const ROOT = join(__dirname, "..", "..");
const route = readFileSync(join(ROOT, "app", "api", "contact", "route.ts"), "utf-8");
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf-8");

describe("the enquiry is written down first", () => {
  it("stores before it sends", () => {
    const stored = route.indexOf("const storedId = await record(body)");
    const sent = route.indexOf("await resend.emails.send(");
    expect(stored, "no store step").toBeGreaterThan(-1);
    expect(sent, "no send step").toBeGreaterThan(-1);
    expect(stored, "the store must come first").toBeLessThan(sent);
  });

  it("keeps the message itself, not just the contact details", () => {
    expect(route).toContain("message: body.message");
    for (const field of ["name: body.name", "email: body.email", "phone: body.phone"]) {
      expect(route, field).toContain(field);
    }
  });

  /**
   * The table arrives with `prisma db push`. A deploy that lands first must
   * not take the form down, so a storage failure is caught and the email is
   * still attempted.
   */
  it("does not let a storage failure break the form", () => {
    expect(route).toContain("console.error(\"[contact] could not store the enquiry\"");
    expect(route).toMatch(/return null;/);
  });
});

describe("a failed send", () => {
  it("still reports success when the enquiry was stored", () => {
    // Inside the send's catch, the stored branch returns ok rather than 500.
    const catchBlock = route.slice(route.indexOf("} catch (sendErr) {"));
    expect(catchBlock).toContain("if (storedId) {");
    expect(catchBlock).toContain('status: "FAILED"');
    expect(catchBlock.indexOf("NextResponse.json({ ok: true })")).toBeGreaterThan(-1);
  });

  it("records why it failed, so it can be chased", () => {
    expect(route).toContain("emailError:");
  });

  it("does not claim success when nothing was stored", () => {
    const catchBlock = route.slice(route.indexOf("} catch (sendErr) {"));
    // Rethrown, so the outer catch returns the 500 it always did.
    expect(catchBlock).toContain("throw sendErr;");
  });

  /** The error text is a message from Resend; the customer's words are not in it. */
  it("never writes the enquiry body into the error column", () => {
    expect(route).not.toMatch(/emailError:\s*body\./);
  });
});

describe("a successful send is marked as such", () => {
  it("moves the row to EMAILED", () => {
    expect(route).toContain('data: { status: "EMAILED" }');
  });

  it("does not fail the request if only the bookkeeping update fails", () => {
    // Both status updates swallow their own errors: the customer's outcome
    // does not depend on a second write succeeding.
    const updates = route.split(".catch(() => {})").length - 1;
    expect(updates).toBeGreaterThanOrEqual(2);
  });
});

describe("the model backing it", () => {
  it("exists with the fields the route writes", () => {
    expect(schema).toContain("model ContactEnquiry {");
    for (const field of ["name", "email", "phone", "message", "status", "emailError"]) {
      expect(schema.slice(schema.indexOf("model ContactEnquiry {")), field).toContain(field);
    }
  });

  it("is indexed for finding the ones that failed", () => {
    const model = schema.slice(schema.indexOf("model ContactEnquiry {"));
    expect(model.slice(0, model.indexOf("}"))).toContain("@@index([status])");
  });
});
