import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recoveredLeadsCard } from "@/lib/email/premium";

/**
 * Getting back the leads whose alert was lost.
 *
 * The alert was fired without being waited for, so on serverless it usually
 * died with the response. What it did not lose is the lead: every one of
 * those customers had written their name, email, phone and route into a
 * bookingSession row before the alert was even attempted. The data was there
 * the whole time; only the telling failed.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const lead = (over: Partial<Parameters<typeof recoveredLeadsCard>[0]["leads"][number]> = {}) => ({
  name: "Husna Tufail Iqbal",
  email: "husna@example.com",
  phone: "+34632857189",
  pickup: "Terminal 1, El Prat Airport BCN",
  dropoff: "Terminal 2, El Prat Airport BCN",
  when: "2026-09-25 05:00",
  passengers: "2",
  quoted: 50,
  step: 3,
  lastActivity: "2026-09-24T18:40:00Z",
  ...over,
});

describe("the digest", () => {
  it("carries what is needed to ring somebody back", () => {
    const html = recoveredLeadsCard({ leads: [lead()], shown: 1 });
    expect(html).toContain("Husna Tufail Iqbal");
    expect(html).toContain("husna@example.com");
    expect(html).toContain("+34632857189");
    expect(html).toContain("Terminal 1");
    expect(html).toContain("Terminal 2");
    // Both are one tap on a phone.
    expect(html).toContain("tel:+34632857189");
    expect(html).toContain("mailto:");
  });

  it("says how stale each one is and how far they got", () => {
    const html = recoveredLeadsCard({ leads: [lead()], shown: 1 });
    expect(html).toContain("reached step 3 of 4");
    expect(html).toContain("last seen");
    expect(html).toContain("quoted &euro;50");
  });

  it("counts correctly and reads correctly for one", () => {
    expect(recoveredLeadsCard({ leads: [lead()], shown: 1 })).toContain("1 lead you were never told about");
    expect(recoveredLeadsCard({ leads: [lead(), lead()], shown: 2 })).toContain("2 leads you were never told about");
  });

  /** A hundred identical emails would be a second failure, not a recovery. */
  it("says when it has trimmed the list rather than pretending it is all of them", () => {
    const html = recoveredLeadsCard({ leads: [lead(), lead()], shown: 140 });
    expect(html).toContain("140 leads you were never told about");
    expect(html).toContain("Showing the 2 most recent of 140");
  });

  it("leaves out the fields a half-filled form never had", () => {
    const html = recoveredLeadsCard({
      leads: [lead({ pickup: null, dropoff: null, when: null, passengers: null, quoted: null })],
      shown: 1,
    });
    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("quoted");
    // Still reachable, which is the point of the whole exercise.
    expect(html).toContain("+34632857189");
  });

  it("escapes what the customer typed", () => {
    const html = recoveredLeadsCard({ leads: [lead({ name: "<script>x</script>" })], shown: 1 });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("the recovery endpoint", () => {
  const route = rd("app/api/admin/recover-leads/route.ts");

  it("is admin only", () => {
    expect(route).toContain('role !== "ADMIN"');
    expect(route).toContain("{ status: 401 }");
  });

  /** The first question is how many, not "are you sure". */
  it("reports without sending unless asked", () => {
    expect(route).toContain('searchParams.get("send") === "1"');
    expect(route).toContain("dryRun: true");
    expect(route).toContain("neverAlertedAndNotBooked");
  });

  it("finds a session with full contact details and no alert in the log", () => {
    expect(route).toContain("email: { not: null }");
    expect(route).toContain("name:  { not: null }");
    expect(route).toContain("phone: { not: null }");
    expect(route).toContain('type: "ADMIN_LEAD"');
    expect(route).toContain("!alerted.has(`LEAD ${s.sessionId}`)");
  });

  /** Somebody who went on to book is not a lost lead. */
  it("leaves out the ones that converted", () => {
    expect(route).toContain("rows.filter((r) => !r.converted)");
  });

  /** So a second run finds nothing, and the nightly job sees them as told. */
  it("writes the log rows the failed sends never wrote", () => {
    expect(route).toContain("prisma.emailLog.createMany");
    expect(route).toContain('type: "ADMIN_LEAD"');
    expect(route).toContain('status: "SENT"');
  });
});
