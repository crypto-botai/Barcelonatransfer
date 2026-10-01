import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * An email sent once is sent once.
 *
 * The pickup reminder went out on the hour, every hour, for as long as a
 * booking sat inside the cron's window. The cron did guard against it:
 *
 *   const alreadySent = await prisma.emailLog.findFirst({
 *     where: { to: b.guestEmail, type: "REMINDER", bookingId: b.id },
 *   });
 *
 * and the guard never fired, because the row it looks for was written by
 * `logEmail({ to, subject, type: "REMINDER", resendId: id })` with no
 * bookingId on it. The lookup asked for a row carrying the booking, the
 * writer saved one without, and nothing ever matched. Customers were woken
 * at 05:00, 06:00 and 07:00 about the same car.
 *
 * The rule that failure breaks is mechanical, so it is checked mechanically:
 * if anything in the codebase decides whether to send by looking for an
 * EmailLog row with a bookingId on it, then the code that sends that type
 * must write the bookingId. Any email type can be added safely as long as
 * both halves agree.
 */

const ROOT = join(__dirname, "..", "..");
const resend = readFileSync(join(ROOT, "lib", "resend.ts"), "utf-8");

/** Every .ts file under app/ and lib/, excluding tests. */
function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  })(join(ROOT, "app"));
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  })(join(ROOT, "lib"));
  return out;
}

/**
 * Email types something refuses to resend on the strength of a bookingId.
 *
 * Found by reading the queries rather than by listing the types here, so a
 * new guarded type is covered the day it is written.
 */
function typesDedupedByBookingId(): Set<string> {
  const found = new Set<string>();
  for (const file of sourceFiles()) {
    const src = readFileSync(file, "utf-8");
    if (!/emailLog\.(findFirst|findMany|count)/.test(src)) continue;
    // The where clause of each emailLog query, flattened.
    for (const m of src.matchAll(/emailLog\.(?:findFirst|findMany|count)\(\{[\s\S]{0,400}?\}\)/g)) {
      const q = m[0].replace(/\s+/g, " ");
      if (!/bookingId/.test(q)) continue;
      for (const t of q.matchAll(/type:\s*"([A-Z_]+)"/g)) found.add(t[1]);
    }
  }
  return found;
}

/** The logEmail call in lib/resend.ts that writes a given type, if any. */
function logCallFor(type: string): string | null {
  const re = new RegExp(`logEmail\\(\\{[^)]*type:\\s*"${type}"[^)]*\\}\\)`, "g");
  const m = resend.match(re);
  return m ? m.join("\n") : null;
}

describe("an email guarded by bookingId is logged with one", () => {
  const guarded = [...typesDedupedByBookingId()].sort();

  it("finds the guarded types at all", () => {
    // If this ever reads empty the scan has broken, and every case below
    // would pass vacuously.
    expect(guarded.length).toBeGreaterThan(2);
    expect(guarded).toContain("REMINDER");
  });

  it.each([...typesDedupedByBookingId()].sort())(
    "%s writes a bookingId on the row its guard reads",
    (type) => {
      const call = logCallFor(type);
      if (!call) return; // logged elsewhere than lib/resend.ts
      expect(
        /bookingId/.test(call),
        `lib/resend.ts logs ${type} without a bookingId, but something refuses to resend ${type} by looking for one. The guard cannot match, so it will send again on every run:\n  ${call.trim()}`,
      ).toBe(true);
    },
  );
});

describe("the pickup reminder sends once, close to the pickup", () => {
  const cron = readFileSync(
    join(ROOT, "app", "api", "cron", "pickup-reminder", "route.ts"),
    "utf-8",
  );

  it("looks 6 to 12 hours ahead, not a day and a half", () => {
    expect(cron).toMatch(/const from\s*=\s*new Date\(Date\.now\(\)\s*\+\s*6\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/);
    expect(cron).toMatch(/const to\s*=\s*new Date\(Date\.now\(\)\s*\+\s*12\s*\*\s*60\s*\*\s*60\s*\*\s*1000\)/);
  });

  it("passes the booking to the sender, so the guard can see it", () => {
    expect(cron).toContain("bookingId:       b.id");
  });

  it("still refuses to send twice for one booking", () => {
    expect(cron).toContain('type: "REMINDER"');
    expect(cron).toContain("bookingId: b.id");
    expect(cron).toContain("if (alreadySent) continue;");
  });
});

describe("only one job sends the pickup reminder", () => {
  /**
   * Two senders is the same bug wearing a different hat: the daily job ran
   * the reminder on a 20-28 hour window while the hourly one had 6-36, so
   * whichever saw the booking first sent it and the other's window never
   * applied. The customer got it a day early, not when it was useful.
   */
  it("the daily cron no longer sends it", () => {
    const daily = readFileSync(join(ROOT, "app", "api", "cron", "daily", "route.ts"), "utf-8");
    expect(daily).not.toContain("runPickupReminder(");
    expect(daily).not.toContain("sendPickupReminder(");
  });

  it("exactly one cron route calls sendPickupReminder", () => {
    const callers = sourceFiles().filter((f) => {
      if (f.endsWith(join("lib", "resend.ts"))) return false;
      return /sendPickupReminder\(/.test(readFileSync(f, "utf-8"));
    });
    expect(callers.map((f) => f.replace(ROOT, ""))).toHaveLength(1);
  });
});
