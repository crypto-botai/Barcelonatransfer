import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  fitTitle,
  fitDescription,
  trimToWord,
  TITLE_MAX,
  DESCRIPTION_MAX,
} from "@/lib/seo";

/**
 * Metadata that fits the SERP, and a brand that appears once.
 *
 * Two faults this guards, both found live on 16 Aug 2026:
 *
 *  1. 53 titles ran past 60 characters and 54 descriptions past 160, so Google
 *     truncated or rewrote them. Most came from the two programmatic templates,
 *     where a long hotel name pushed a fixed suffix over.
 *
 *  2. Fifteen pages set `title` as a plain string. The root layout carries
 *     `template: "%s | Elite BCN Transfers"`, so a title already ending in
 *     "| Elite BCN" was published as "… | Elite BCN | Elite BCN Transfers".
 */

const STAFF = /[\\/](admin|driver|dashboard|auth|api)[\\/]/;

function publicPages(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (STAFF.test(full + path.sep)) continue;
      if (e.isDirectory()) walk(full);
      else if (e.name === "page.tsx") out.push(full);
    }
  })("app");
  return out;
}

describe("fitTitle", () => {
  it("takes the first candidate that fits", () => {
    expect(fitTitle(["a".repeat(80), "short one"])).toBe("short one");
  });

  it("prefers the longest fitting candidate, not merely the shortest", () => {
    const fits = "a".repeat(50);
    expect(fitTitle([fits, "tiny"])).toBe(fits);
  });

  it("trims the last candidate when nothing fits, at a word boundary", () => {
    const out = fitTitle(["Mandarin Oriental Barcelona Hotel Private Airport Transfer Service Extra"]);
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(out.endsWith(" ")).toBe(false);
    // never mid-word
    expect(out.split(" ").pop()).not.toBe("Servi");
  });

  it("survives an empty candidate list", () => {
    expect(fitTitle([])).toBe("");
  });
});

describe("fitDescription", () => {
  it("keeps every clause when they fit", () => {
    expect(fitDescription(["One.", "Two.", "Three."])).toBe("One. Two. Three.");
  });

  it("drops trailing clauses rather than truncating mid-sentence", () => {
    const out = fitDescription(["A".repeat(100) + ".", "B".repeat(100) + "."]);
    expect(out).toBe("A".repeat(100) + ".");
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("ignores empty clauses", () => {
    expect(fitDescription(["One.", "", "Two."])).toBe("One. Two.");
  });

  it("never exceeds the limit even on a single over-long clause", () => {
    const out = fitDescription(["word ".repeat(80)]);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe("trimToWord", () => {
  it("leaves a short string alone", () => {
    expect(trimToWord("hello", 20)).toBe("hello");
  });

  it("cuts at a space and strips trailing punctuation", () => {
    expect(trimToWord("alpha beta gamma delta", 16)).toBe("alpha beta");
  });
});

describe("no page lets the layout append the brand twice", () => {
  // A plain-string title gets "| Elite BCN Transfers" appended. That is fine
  // for a title that carries no brand of its own, and wrong for one that does.
  const BRAND = /Elite\s*BCN/i;

  it.each(publicPages())("%s does not double the brand", (page) => {
    const src = fs.readFileSync(page, "utf8");
    if (!/export const metadata|generateMetadata/.test(src)) return;

    // The page-level title is the first `title:` in the file; og/twitter come
    // after and are not run through the layout template.
    const m = src.match(/title:\s*(\{[^}]*\}|`[^`]*`|"[^"]*")/);
    if (!m) return;

    const isAbsolute = m[1].startsWith("{");
    if (isAbsolute) return;

    expect(
      BRAND.test(m[1]),
      `${page} sets a plain title containing the brand, so the layout appends it a second time — mark it absolute`,
    ).toBe(false);
  });
});

describe("the /book explainer matches the form's actual steps", () => {
  // The page carries a static "how it works" list beside the form. It described
  // "Your Journey / Choose Vehicle / Confirm & Pay" after the form had moved to
  // journey, details, then vehicle — so the page and the form disagreed about
  // what would happen next.
  it("names the same three steps, in the same order", () => {
    const form = fs.readFileSync("app/book/BookFormClient.tsx", "utf8");
    const page = fs.readFileSync("app/book/page.tsx", "utf8");

    const stepsBlock = form.slice(form.indexOf("const STEPS = ["));
    const labels = [...stepsBlock.slice(0, stepsBlock.indexOf("];")).matchAll(/label:\s*"([^"]+)"/g)]
      .map((m) => m[1].toLowerCase());
    expect(labels).toHaveLength(3);

    const titles = [...page.matchAll(/\{\s*n:\s*\d+,\s*title:\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase());
    expect(titles, "app/book/page.tsx should list three steps").toHaveLength(3);

    // Compared on the distinguishing word rather than exact string, since the
    // page phrases each one as a sentence heading.
    for (let i = 0; i < 3; i++) {
      const key = labels[i].split(" ")[0].replace(/[^a-z]/g, "");
      expect(
        titles[i],
        `step ${i + 1}: form says "${labels[i]}", page says "${titles[i]}"`,
      ).toContain(key);
    }
  });
});
