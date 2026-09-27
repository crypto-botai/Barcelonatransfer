import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * One missing variable must not fail the whole deployment.
 *
 * `new Resend(key)` throws when the key is absent. Two modules ran that at
 * import time, and `next build` imports every route to collect page data —
 * so a build environment without RESEND_API_KEY did not break email, it
 * broke the build. The deploy failed on "Failed to collect page data for
 * /api/cron/orchestrator", which names neither Resend nor the variable, and
 * the site sat on the previous release while the cause looked like a
 * configuration problem somewhere else entirely.
 *
 * The client is therefore built on first use, in one place. A send with no
 * key now fails as a send.
 */

const ROOT = join(__dirname, "..", "..");
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "coverage", "__tests__"]);

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const posix = (p: string) => relative(ROOT, p).split(sep).join("/");

/** Comments explain the bug and so name the constructor; code must not run it. */
function constructsAClient(src: string): boolean {
  return src.split("\n").some((line) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*")) return false;
    return t.includes("new Resend(");
  });
}

describe("the Resend client is built on first use", () => {
  const files = [...sources(join(ROOT, "lib")), ...sources(join(ROOT, "app"))];

  it("is constructed in exactly one file", () => {
    const builders = files
      .filter((f) => constructsAClient(readFileSync(f, "utf-8")))
      .map(posix)
      .sort();
    expect(builders).toEqual(["lib/resend.ts"]);
  });

  it("is built inside a function there, not at module scope", () => {
    const src = readFileSync(join(ROOT, "lib", "resend.ts"), "utf-8");
    expect(src).toContain("function getResend()");
    expect(src).toContain("if (!_resend) _resend = new Resend(");
    // A bare top-level `const x = new Resend(...)` is the thing that broke.
    for (const line of src.split("\n")) {
      expect(line.startsWith("const ") && line.includes("new Resend(")).toBe(false);
    }
  });

  it("is what the AI modules use", () => {
    for (const f of ["lib/ai/alerts.ts", "lib/ai/agents/booking.ts"]) {
      const src = readFileSync(join(ROOT, f), "utf-8");
      expect(src, f).toContain('import { resend } from "@/lib/resend"');
    }
  });
});
