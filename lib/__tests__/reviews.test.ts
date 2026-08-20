import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { REVIEWS, GOOGLE_PROFILE, initials } from "@/data/reviews";
import { SOCIAL_PROOF } from "@/lib/company-facts";

/**
 * Reviews have to be real, and the rating has to be the one on the profile.
 *
 * What this replaced: six invented testimonials with invented names and cities,
 * a SOCIAL_PROOF of 4.9 from 312 that matched no profile, and an /about page
 * claiming 595. The live Google profile holds 5.0 from 15.
 *
 * Publishing review counts you cannot evidence is penalised under the EU
 * unfair-practices rules, and the figure here also goes into the structured
 * data Google reads, so it is the one a reader would find if they looked.
 */

describe("the published rating matches the profile", () => {
  it("SOCIAL_PROOF derives from the reviews file rather than repeating it", () => {
    expect(SOCIAL_PROOF.google.rating).toBe(GOOGLE_PROFILE.rating);
    expect(SOCIAL_PROOF.google.count).toBe(GOOGLE_PROFILE.count);
  });

  it("states a plausible rating and a real count", () => {
    expect(GOOGLE_PROFILE.rating).toBeGreaterThan(0);
    expect(GOOGLE_PROFILE.rating).toBeLessThanOrEqual(5);
    expect(GOOGLE_PROFILE.count).toBeGreaterThan(0);
    expect(Number.isInteger(GOOGLE_PROFILE.count)).toBe(true);
  });

  it("never shows more reviews than the profile holds", () => {
    // Transcribing 16 reviews onto a profile of 15 would mean one is invented.
    expect(REVIEWS.length).toBeLessThanOrEqual(GOOGLE_PROFILE.count);
  });
});

describe("every review is a real one", () => {
  it("has an author, a rating and a date", () => {
    for (const r of REVIEWS) {
      expect(r.author.trim().length, `author on a ${r.rating}-star review`).toBeGreaterThan(0);
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
      expect(r.when.trim().length, `date on ${r.author}`).toBeGreaterThan(0);
    }
  });

  it("either quotes real words or none — never a stub", () => {
    // A rating with no comment is legitimate and is rendered as such. What must
    // not happen is a few words invented to fill the space.
    for (const r of REVIEWS) {
      if (r.text === undefined) continue;
      expect(r.text.trim().length, `text from ${r.author} is too short to be real`).toBeGreaterThan(20);
    }
  });

  it("carries no duplicate text", () => {
    // The same words under two names is the signature of a fabricated set.
    const seen = new Set<string>();
    for (const r of REVIEWS) {
      if (!r.text) continue;
      const key = r.text.trim().toLowerCase();
      expect(seen.has(key), `duplicated review text under ${r.author}`).toBe(false);
      seen.add(key);
    }
  });

  it("uses none of the invented names that were removed", () => {
    const INVENTED = ["James H.", "Sophie B.", "Marcus V.", "Isabella R.", "Michael C.", "Laura J."];
    for (const r of REVIEWS) {
      expect(INVENTED, `${r.author} was one of the fabricated testimonials`).not.toContain(r.author);
    }
  });
});

describe("the reviews section", () => {
  const src = fs.readFileSync("components/sections/TestimonialsSection.tsx", "utf8");

  it("reads the reviews file rather than declaring its own", () => {
    expect(src).toMatch(/from "@\/data\/reviews"/);
    // A quoted testimonial written into the component is how the last set of
    // invented ones got there.
    const inline = [...src.matchAll(/text:\s*"[^"]{40,}"/g)];
    expect(inline.map((m) => m[0].slice(0, 50))).toEqual([]);
  });

  it("does not link the reviews out to Google", () => {
    // The owner asked for them to stay on the site.
    const body = src.slice(src.indexOf("REVIEWS.map"));
    expect(body).not.toMatch(/<a\s/);
    expect(body).not.toMatch(/href=/);
  });

  it("shows the verified badge per review, not once for all of them", () => {
    expect(src).toMatch(/r\.verified\s*&&/);
  });
});

describe("initials", () => {
  it("takes the first and last initial", () => {
    expect(initials("licencia hub")).toBe("LH");
    expect(initials("Maria Garcia Lopez")).toBe("ML");
  });

  it("handles a single name", () => {
    expect(initials("Marta")).toBe("MA");
  });

  it("does not fall over on an empty name", () => {
    expect(initials("   ")).toBe("?");
  });
});
