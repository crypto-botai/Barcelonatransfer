import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * An email started but never finished.
 *
 * A serverless instance may freeze the moment its response is returned, and
 * anything still in flight dies with it. A promise that is neither awaited
 * nor handed to `after()` is therefore a coin toss, not a send.
 *
 * This is how the booking leads were lost in September: the session handler
 * called `void alertOnFirstContact(...)` and the alert usually, but not
 * always, survived long enough to reach Resend. The same shape was still in
 * the admin booking route on 29 Sept — three sends with a `.catch()` and no
 * `await` and no `after()` — so every booking the office created by hand was
 * relying on the same luck for its confirmation email.
 *
 * A `.catch()` is not a fix. It handles a rejection that happens; it does
 * nothing about a promise that is never given the chance to settle.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/** Routes that send email as part of handling a request. */
const ROUTES = [
  "app/api/admin/bookings/route.ts",
  "app/api/bookings/route.ts",
  "app/api/booking-session/route.ts",
  "app/api/contact/route.ts",
];

/**
 * A send is safe when the same line awaits it, schedules it with after(), or
 * collects it into something that is awaited. Anything else is fire and
 * forget.
 */
function unscheduledSends(src: string): string[] {
  const out: string[] = [];
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const m = /(?<![\w.])(send[A-Z][A-Za-z]*)\s*\(/.exec(line);
    if (!m) return;

    const trimmed = line.trim();
    // Declarations, imports and comments are not call sites.
    if (/^(import|export|\*|\/\/|\/\*)/.test(trimmed)) return;
    if (/function\s+send[A-Z]/.test(line)) return;

    const scheduled =
      /\bawait\b/.test(line) ||
      /after\(\s*\(\)\s*=>/.test(line) ||
      /\.push\(/.test(line) ||
      /=\s*send[A-Z]/.test(line);

    if (!scheduled) out.push(`line ${i + 1}: ${trimmed.slice(0, 80)}`);
  });

  return out;
}

describe("every email is either awaited or handed to after()", () => {
  it.each(ROUTES)("%s starts no send it cannot finish", (route) => {
    expect(unscheduledSends(rd(route)), route).toEqual([]);
  });

  it("the admin booking route schedules its three sends", () => {
    const src = rd("app/api/admin/bookings/route.ts");
    expect(src).toContain("after(() => sendBookingConfirmation({");
    expect(src).toContain("after(() => sendAdminNewBookingAlert({");
    expect(src).toContain('import { NextRequest, NextResponse, after } from "next/server"');
  });

  /** The original case, kept so the fix cannot be undone quietly. */
  it("the session handler still uses after() for the lead alert", () => {
    const src = rd("app/api/booking-session/route.ts");
    expect(src).toContain("after(() => alertOnFirstContact(");
    expect(src).not.toContain("void alertOnFirstContact(");
  });
});

describe("the detector itself", () => {
  it("catches a bare send", () => {
    expect(unscheduledSends("  sendThing({ a: 1 });")).toHaveLength(1);
  });

  it("accepts an awaited send", () => {
    expect(unscheduledSends("  await sendThing({ a: 1 });")).toEqual([]);
  });

  it("accepts a scheduled send", () => {
    expect(unscheduledSends("  after(() => sendThing({ a: 1 }));")).toEqual([]);
  });

  it("is not fooled by a .catch() alone", () => {
    // The shape that looked handled and was not.
    expect(unscheduledSends("  sendThing({ a: 1 }).catch(() => {});")).toHaveLength(1);
  });

  it("ignores imports and declarations", () => {
    expect(unscheduledSends('import { sendThing } from "@/lib/resend";')).toEqual([]);
    expect(unscheduledSends("export async function sendThing({ a }) {")).toEqual([]);
  });
});
