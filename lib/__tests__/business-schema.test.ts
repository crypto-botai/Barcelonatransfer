import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { organisationRef } from "@/lib/schema";

/**
 * The site described itself to Google in four places and disagreed with itself
 * in all of them.
 *
 * The LocalBusiness node claimed streetAddress "Barcelona El Prat Airport" with
 * the airport's coordinates — a location the business does not occupy, and a
 * different municipality from Barcelona. The Organization node claimed postcode
 * 08001, central Barcelona. Neither was the real premises, Carrer de Llull 465,
 * 08019. The geo meta tags carried the airport coordinates too.
 *
 * A location claim that disagrees with the Google Business Profile works
 * directly against map-pack ranking, and a fabricated one puts the profile at
 * risk. These lock the corrected values in place.
 */
const LAYOUT = readFileSync(join(process.cwd(), "app", "layout.tsx"), "utf-8");
const ABOUT = readFileSync(join(process.cwd(), "app", "about", "page.tsx"), "utf-8");

const REAL = {
  street: "Carrer de Llull 465",
  postcode: "08019",
  lat: "41.4131552",
  lng: "2.2178314",
};

describe("the business states one address, and it is the real one", () => {
  it("uses the registered premises in both schema nodes", () => {
    // Count the declaration, not the string — a comment also names the street.
    const streets = LAYOUT.split(`streetAddress: "${REAL.street}"`).length - 1;
    expect(streets, "expected the address on Organization and LocalBusiness").toBe(2);
    expect(LAYOUT.split(`postalCode: "${REAL.postcode}"`).length - 1).toBe(2);
  });

  it("no longer claims premises at the airport", () => {
    expect(LAYOUT).not.toContain('streetAddress: "Barcelona El Prat Airport"');
    expect(LAYOUT).not.toContain('postalCode: "08820"');
    expect(LAYOUT).not.toContain('postalCode: "08001"');
  });

  it("carries no airport coordinates in schema or geo meta", () => {
    // 41.2974 / 2.0833 is El Prat. Appearing anywhere in the root layout means
    // the business is claiming to sit on the apron again.
    expect(LAYOUT).not.toMatch(/41\.2974/);
    expect(LAYOUT).not.toMatch(/2\.0833/);
  });

  it("geocodes the premises rather than guessing", () => {
    expect(LAYOUT).toContain(REAL.lat);
    expect(LAYOUT).toContain(REAL.lng);
  });

  it("declares opening hours and languages on the business node", () => {
    expect(LAYOUT).toContain("openingHoursSpecification");
    expect(LAYOUT).toContain("knowsLanguage");
  });

  it("does not claim Catalan, which the site does not publish", () => {
    expect(LAYOUT).not.toMatch(/"Catalan"/);
  });
});

describe("one entity, not three", () => {
  it("resolves provider to the business node by reference", () => {
    // organisationRef() used to redeclare the whole business under a third
    // "@id" of /#org, splitting the entity across three identities.
    const ref = organisationRef() as Record<string, unknown>;
    expect(Object.keys(ref)).toEqual(["@id"]);
    expect(ref["@id"]).toBe("https://www.elitebcn.info/#business");
  });

  it("does not redeclare the organisation on the about page", () => {
    expect(ABOUT).not.toMatch(/"@type":\s*"Organization"/);
    expect(ABOUT).toContain('{ "@id": "https://www.elitebcn.info/#organization" }');
  });
});

describe("no self-serving review markup", () => {
  it("keeps aggregateRating out of the provider reference", () => {
    // This was live on /book. The figures were real, but reviews about a
    // business published on that business's own site are self-serving under
    // Google's policy: ineligible for rich results, manual-action risk.
    expect(JSON.stringify(organisationRef())).not.toContain("aggregateRating");
  });

  it("declares no rating anywhere in the root schema", () => {
    expect(LAYOUT).not.toMatch(/aggregateRating/i);
    expect(LAYOUT).not.toMatch(/ratingValue/i);
    expect(ABOUT).not.toMatch(/aggregateRating/i);
  });
});
