import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Nothing a request starts may outlive the response.
 *
 * This is how the lead alerts stopped arriving. The booking-session handler
 * saved the session, fired the alert with a bare `void`, and returned. On
 * serverless the instance can be frozen the moment the response is sent, and
 * the alert needs three database round trips and an HTTP call to Resend
 * before it has sent anything — so it usually lost that race. Nothing errored
 * and nothing was logged, because the code that would have logged it was
 * itself in the part that never ran.
 *
 * The same file was already using after() correctly for the abandoned-cart
 * sweep, one line above. That is what makes this worth a test rather than a
 * fix: the right tool was in the file and the wrong one was used next to it.
 */

const ROOT = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (/node_modules|\.next|__tests__/.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("work started in a request is waited for", () => {
  it("no route handler fires an async call with a bare void", () => {
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, "app", "api"))) {
      const src = readFileSync(f, "utf-8");
      src.split("\n").forEach((line, i) => {
        // `void 0` is an idiom, not a call.
        const m = line.match(/^\s*void\s+([a-zA-Z_$][\w$]*)\s*\(/);
        if (!m) return;
        offenders.push(`${relative(ROOT, f).replace(/\\/g, "/")}:${i + 1}  void ${m[1]}(`);
      });
    }
    expect(
      offenders,
      `these race the response — use after() from "next/server":\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  /** The three that were doing it, now named so a revert is obvious. */
  it("the handlers that were losing messages use after()", () => {
    const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

    const session = rd("app/api/booking-session/route.ts");
    expect(session).toContain("after(() => alertOnFirstContact(");
    expect(session).not.toContain("void alertOnFirstContact(");

    expect(rd("app/api/arrival/[token]/route.ts")).toContain("after(() => notifyAdminWhatsApp(");
    expect(rd("app/api/driver/no-show/route.ts")).toContain("after(() => notifyAdminWhatsApp(");
  });

  /**
   * A cron is a request too. The sweep returned as soon as its loop ended,
   * with the alerts it had started still in flight.
   */
  it("the flight sweep waits for the alerts it started", () => {
    const sweep = readFileSync(join(ROOT, "lib/flights/sweep.ts"), "utf-8");
    expect(sweep).toContain("const pending: Promise<unknown>[] = []");
    expect(sweep).toContain("pending.push(notifyAdmin(");
    expect(sweep).toContain("pending.push(sendOpsFlightAlert(");
    expect(sweep).toContain("await Promise.allSettled(pending)");
    expect(sweep).not.toContain("void notifyAdmin(");
    expect(sweep).not.toContain("void sendOpsFlightAlert(");
  });
});
