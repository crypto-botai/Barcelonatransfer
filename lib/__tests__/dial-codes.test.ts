import { describe, expect, it } from "vitest";
import {
  DIAL_CODES,
  ORDERED_DIAL_CODES,
  PRIORITY_ISO,
  dialCodeFor,
  flagFor,
  isUsablePhone,
  searchDialCodes,
  splitE164,
  toE164,
} from "@/lib/dial-codes";

/**
 * The booking form accepted a phone number with no country and no length check:
 * `!!data.guestPhone` passed on a single digit. A guest typing "612345678" left
 * the dispatcher unable to tell Spanish from French from mistyped, and a driver
 * who cannot reach the passenger at arrivals loses the fare and the review.
 *
 * These cover the parts that decide whether a real number survives the round
 * trip — the split, the rejoin and the check — rather than the shape of the
 * dropdown.
 */

describe("the dial code table is sane", () => {
  it("has no duplicate countries", () => {
    const isos = DIAL_CODES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it("every entry has a two-letter code and a numeric dial code", () => {
    for (const c of DIAL_CODES) {
      expect(c.iso, c.name).toMatch(/^[A-Z]{2}$/);
      expect(c.dial, c.name).toMatch(/^\d{1,4}$/);
      expect(c.name.trim().length).toBeGreaterThan(1);
    }
  });

  it("covers the markets this business actually flies passengers in from", () => {
    // A missing country is not cosmetic: that customer cannot enter their real
    // number, and the booking is lost outright.
    for (const iso of ["ES", "GB", "FR", "DE", "IT", "US", "NL", "IE", "AD",
                       "PT", "BE", "CH", "SE", "NO", "PL", "RU", "CN", "JP",
                       "AE", "SA", "IL", "BR", "AR", "MX", "AU", "IN", "MA"]) {
      expect(dialCodeFor(iso), `${iso} missing`).toBeDefined();
    }
  });

  it("spot-checks dial codes against known values", () => {
    const known: Record<string, string> = {
      ES: "34", GB: "44", FR: "33", DE: "49", IT: "39", US: "1", CA: "1",
      NL: "31", IE: "353", AD: "376", PT: "351", CH: "41", AT: "43",
      RU: "7", CN: "86", JP: "81", AE: "971", BR: "55", AU: "61", IN: "91",
      MA: "212", TR: "90", GR: "30", MT: "356",
    };
    for (const [iso, dial] of Object.entries(known)) {
      expect(dialCodeFor(iso)?.dial, iso).toBe(dial);
    }
  });

  it("puts the priority countries first and loses nothing", () => {
    expect(ORDERED_DIAL_CODES.length).toBe(DIAL_CODES.length);
    expect(ORDERED_DIAL_CODES.slice(0, PRIORITY_ISO.length).map((c) => c.iso))
      .toEqual([...PRIORITY_ISO]);
  });

  it("renders a flag from the country code", () => {
    expect(flagFor("ES")).toBe("🇪🇸");
    expect(flagFor("gb")).toBe("🇬🇧");
  });
});

describe("search finds a country the way someone would look for it", () => {
  it("matches on name, partial name and case", () => {
    expect(searchDialCodes("portug").map((c) => c.iso)).toContain("PT");
    expect(searchDialCodes("UNITED KING").map((c) => c.iso)).toContain("GB");
  });

  it("matches on dial code, with or without the plus", () => {
    expect(searchDialCodes("351").map((c) => c.iso)).toContain("PT");
    expect(searchDialCodes("+351").map((c) => c.iso)).toContain("PT");
  });

  it("returns everything for an empty query and nothing for nonsense", () => {
    expect(searchDialCodes("").length).toBe(DIAL_CODES.length);
    expect(searchDialCodes("zzzzz")).toEqual([]);
  });
});

describe("a number survives the round trip", () => {
  it("joins a country and a national number into E.164", () => {
    expect(toE164("ES", "612345678")).toBe("+34612345678");
    expect(toE164("GB", "7700 900123")).toBe("+447700900123");
  });

  it("drops the trunk zero, which is how people write their own number", () => {
    // "07700 900123" is how a British guest says it; +4407700... is not dialable.
    expect(toE164("GB", "07700900123")).toBe("+447700900123");
    expect(toE164("IT", "0612345678")).toBe("+39612345678");
  });

  it("splits a stored number back into country and national parts", () => {
    expect(splitE164("+34612345678")).toEqual({ iso: "ES", national: "612345678" });
    expect(splitE164("+447700900123")).toEqual({ iso: "GB", national: "7700900123" });
  });

  it("prefers the longest dial code, so Caribbean numbers are not read as US", () => {
    // 1868 must beat 1, or Trinidad resolves to the United States.
    expect(splitE164("+18685551234").iso).toBe("TT");
    // +1 is genuinely shared by the US, Canada and much of the Caribbean, and
    // separating them needs area-code tables. The tie breaks to the US, which
    // is cosmetic only — the stored and dialled number is the same either way.
    expect(splitE164("+12125551234").iso).toBe("US");
  });

  it("round-trips without losing digits", () => {
    for (const [iso, national] of [["ES", "612345678"], ["DE", "15112345678"], ["AD", "312345"]] as const) {
      const back = splitE164(toE164(iso, national));
      expect(back.iso).toBe(iso);
      expect(back.national).toBe(national);
    }
  });

  it("reports no country for a number stored without one", () => {
    // Exactly the state the old form left every booking in.
    expect(splitE164("612345678").iso).toBeNull();
  });
});

describe("the check rejects what the old one let through", () => {
  it("rejects an empty field, a stray digit and a country-less number", () => {
    expect(isUsablePhone("ES", "")).toBe(false);
    expect(isUsablePhone("ES", "6")).toBe(false);
    expect(isUsablePhone("ES", "12345")).toBe(false);
    expect(isUsablePhone(null, "612345678")).toBe(false);
  });

  it("rejects a country that is not in the table", () => {
    expect(isUsablePhone("XX", "612345678")).toBe(false);
  });

  it("rejects a number longer than E.164 allows", () => {
    expect(isUsablePhone("ES", "1234567890123456")).toBe(false);
  });

  it("accepts real numbers, however they are punctuated", () => {
    expect(isUsablePhone("ES", "612345678")).toBe(true);
    expect(isUsablePhone("GB", "7700 900 123")).toBe(true);
    expect(isUsablePhone("US", "(212) 555-1234")).toBe(true);
    expect(isUsablePhone("AD", "312345")).toBe(true);
  });
});
