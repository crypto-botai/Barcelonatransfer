import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A failed alert is not an alert.
 *
 * Both of these came out of one look at the live email log, and both had the
 * same shape: code that asked whether a row existed when the question was
 * whether a row had succeeded.
 *
 * In the recovery tool that meant the leads most needing recovery were the
 * ones it skipped. A FAILED send and a claim left PENDING both counted as
 * "already told", so Jason Davis — whose alert Resend refused outright —
 * was filtered out of the very list meant to find him.
 *
 * In the session handler it was worse than a miscount. The claim is written
 * before the send and deleted after; when the send throws, the claim stays.
 * The next request counted that row, saw a prior attempt, and returned. So a
 * single failed send blocked that session's alert permanently and silently.
 * One claim had been sitting there for two days.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("the recovery tool counts what was delivered", () => {
  it("only a SENT row means the office was told", () => {
    const route = rd("app/api/admin/recover-leads/route.ts");
    expect(route).toContain('where: { type: "ADMIN_LEAD", status: "SENT" }');
  });

  it("does not treat every row as an alert regardless of outcome", () => {
    const route = rd("app/api/admin/recover-leads/route.ts");
    // The old query, which swept FAILED and PENDING in with the delivered.
    expect(route).not.toMatch(/where: \{ type: "ADMIN_LEAD" \},\s*\n\s*select: \{ subject: true \}/);
  });
});

describe("a stale claim does not block the lead forever", () => {
  const session = rd("app/api/booking-session/route.ts");

  it("stops only when the alert actually went", () => {
    expect(session).toContain('priors.some((r) => r.status === "SENT")');
  });

  /** A request still in flight must win the race; a dead one must not. */
  it("honours a claim only while it could still be running", () => {
    expect(session).toContain("const CLAIM_TTL_MS = 5 * 60_000");
    expect(session).toContain('r.status === "PENDING" && Date.now() - r.createdAt.getTime() < CLAIM_TTL_MS');
  });

  it("clears an older claim so the alert can be tried again", () => {
    expect(session).toContain('priors.filter((r) => r.status !== "SENT")');
    expect(session).toContain("prisma.emailLog.deleteMany");
  });

  it("no longer returns on the mere existence of a row", () => {
    expect(session).not.toContain('const already = await prisma.emailLog.count({ where: { type: "ADMIN_LEAD", subject } })');
  });
});

/**
 * The claim exists to stop two concurrent saves both emailing. Loosening it
 * must not bring that back, so the winner is still decided by reading the
 * earliest claim rather than by whoever wrote last.
 */
describe("the duplicate guard still holds", () => {
  const session = rd("app/api/booking-session/route.ts");

  it("still stakes a claim before sending", () => {
    expect(session).toContain('status: "PENDING"');
    expect(session).toContain("prisma.emailLog.create");
  });

  it("still lets the earliest claim win", () => {
    expect(session).toContain('orderBy: [{ createdAt: "asc" }, { id: "asc" }]');
    expect(session).toContain("winner?.id !== claim.id");
  });
});
