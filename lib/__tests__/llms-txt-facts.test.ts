import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GOOGLE_PROFILE } from "../../data/reviews";

// public/llms.txt and public/llms-full.txt are read verbatim by AI assistants,
// which do not verify what they find there. They drifted once already: both
// still advertised 4.9★ from 312 Google reviews plus Trustpilot and TripAdvisor
// profiles, months after data/reviews.ts was corrected to the real 5.0★ from 15
// and the two other platforms were confirmed not to exist.
//
// These files are plain text, so nothing imports them and nothing else can catch
// the drift. This test is the only thing standing between the corrected numbers
// and the next time someone edits one file and not the other.

const read = (f: string) => readFileSync(resolve(__dirname, "../../public", f), "utf8");
const FILES = ["llms.txt", "llms-full.txt"] as const;

describe("llms.txt review claims", () => {
  it.each(FILES)("%s states the rating held in data/reviews.ts", (file) => {
    const text = read(file);
    // toFixed(1) because the file writes "5.0★" and the constant is the number 5.
    expect(text).toContain(`${GOOGLE_PROFILE.rating.toFixed(1)}★`);
    expect(text).toContain(`${GOOGLE_PROFILE.count} reviews`);
  });

  it.each(FILES)("%s claims no review platform the business is not on", (file) => {
    // Naming a platform is allowed only to say there is no profile on it —
    // that instruction is what stops an assistant inventing one.
    for (const line of read(file).split("\n")) {
      if (/trustpilot|tripadvisor/i.test(line)) {
        expect(line).toMatch(/\bNo Trustpilot\b|\bNo TripAdvisor\b|No Trustpilot or TripAdvisor/i);
      }
    }
  });

  it.each(FILES)("%s carries no superseded review count", (file) => {
    const text = read(file);
    // Word-bounded: the Maps cid is a long digit run that happens to contain
    // "312", and the route table legitimately says "315 fixed prices".
    for (const stale of ["312", "189", "595", "94"]) {
      expect(text).not.toMatch(new RegExp(`\\b${stale}\\b`));
    }
    for (const stale of ["4.9★", "4.8★"]) {
      expect(text).not.toContain(stale);
    }
  });
});
