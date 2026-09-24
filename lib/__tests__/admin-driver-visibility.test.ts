import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Seeing the driver, in both senses.
 *
 * The office reported two things about the same job. The assign box opened as
 * a white panel of white names, because the list a native select drops is
 * drawn by the operating system on its own opaque background while the
 * options inherit our white text. And once a driver was assigned, the
 * bookings table still did not say who: it had a Driver Pay column and no
 * Driver column, so an assigned job and an unassigned one looked identical
 * until you opened each one.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("a dark select's open list", () => {
  const css = rd("app/globals.css");

  it("gives options a background of their own, not the operating system's", () => {
    expect(css).toContain(".input-luxury option");
    expect(css).toContain("select.text-white option");
    expect(css).toMatch(/background-color:\s*#14130f/);
  });

  it("covers optgroups and disabled options too", () => {
    // "Our drivers" / "Fleet companies" on the dispatch board are optgroups,
    // and "Assign driver…" is a disabled placeholder option.
    expect(css).toContain(".input-luxury optgroup");
    expect(css).toContain("select.text-white option:disabled");
  });

  /**
   * Every dark select on the site is covered by one of the two selectors, so
   * a new one cannot reintroduce this by forgetting a class on its options.
   */
  it("reaches every select in the admin and partner panels", () => {
    const files: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (/node_modules|\.next|__tests__/.test(p)) continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith(".tsx")) files.push(p);
      }
    })(join(ROOT, "app", "admin"));
    files.push(join(ROOT, "components", "admin", "DispatchBoard.tsx"));

    const uncovered: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      // A class can come from a const in the same file, whether interpolated
      // (className={`${inputCls} …`}) or passed whole (className={field}).
      const resolve = (tag: string) => {
        let out = tag;
        const refs = [
          ...[...tag.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]),
          ...[...tag.matchAll(/className=\{(\w+)\}/g)].map((m) => m[1]),
        ];
        for (const ref of refs) {
          const decl = src.match(new RegExp(`const ${ref}\\s*=\\s*["'\`]([^"'\`]*)`));
          if (decl) out += " " + decl[1];
        }
        return out;
      };

      // From <select up to its first option, which is the whole opening tag
      // however many arrow functions are inside it. Matching to the first ">"
      // stops inside onChange={(e) =>, before the className is reached.
      for (const m of src.matchAll(/<select\b[\s\S]*?(?=<option|<\/select)/g)) {
        const tag = resolve(m[0]);
        if (tag.includes("input-luxury") || tag.includes("text-white")) continue;
        uncovered.push(`${relative(ROOT, f).replace(/\\/g, "/")}: ${tag.replace(/\s+/g, " ").slice(0, 100)}`);
      }
    }
    expect(uncovered, `a select neither .input-luxury nor .text-white, so its dropdown is unstyled:\n${uncovered.join("\n")}`).toEqual([]);
  });
});

describe("the bookings table", () => {
  const page = rd("app/admin/bookings/page.tsx");

  it("has a Driver column, not only a Driver Pay one", () => {
    expect(page).toContain(">Driver</th>");
    expect(page).toContain(">Driver Pay</th>");
    expect(page).toContain("b.driver.user.name");
  });

  it("distinguishes unassigned from sent-to-a-company but not yet driven", () => {
    expect(page).toContain("Not assigned");
    expect(page).toContain("awaiting their driver");
  });

  /** A column added without widening the empty row leaves the table ragged. */
  it("spans the empty state across every column", () => {
    const headers = (page.match(/<th\b/g) ?? []).length;
    expect(page).toContain("colSpan={11}");
    expect(headers).toBeGreaterThanOrEqual(11);
  });
});
