import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fg from "fast-glob";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

/**
 * One business entity, referenced — never a second copy of it.
 *
 * The 25 Aug schema work consolidated four conflicting descriptions of the
 * company into a single LocalBusiness at "/#business", carrying the real
 * address, the geo point, the opening hours and knowsLanguage. Ten Service and
 * BlogPosting nodes across nine pages kept redeclaring the company inline as
 * `{ "@type": "Organization", name: "Elite BCN Transfers", url: ... }`, which
 * produces an anonymous node with no address, no hours and no sameAs, and no
 * connection to the entity that has them.
 *
 * /contact was the expensive one. Its inline copy also declared
 * `availableLanguage: ["English", "Spanish", "Catalan"]`. Catalan had been
 * deliberately removed from the layout and from llms.txt because the site does
 * not publish in it — but the test guarding that read app/layout.tsx and
 * nothing else, so this copy survived and went on making the claim.
 *
 * These read every page, which is the part that was missing.
 */

const APP = join(process.cwd(), "app");

const PAGES = fg
  .sync("**/page.tsx", { cwd: APP, absolute: true })
  // Staff surfaces carry no public structured data.
  .filter((p) => !/[\\/](admin|driver|dashboard|auth)[\\/]/.test(p));

function read(p: string) {
  return readFileSync(p, "utf-8");
}

function rel(p: string) {
  return p.slice(APP.length + 1).replace(/\\/g, "/");
}

describe("the company is referenced by @id, not redeclared", () => {
  it("finds pages to check", () => {
    expect(PAGES.length).toBeGreaterThan(30);
  });

  it("no page redeclares the Organization inline inside a provider, publisher or author", () => {
    const inline = /(provider|publisher|author):\s*\{\s*"@type":\s*"Organization"/;
    const offenders = PAGES.filter((p) => inline.test(read(p))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("no page outside the layout declares a second LocalBusiness", () => {
    const offenders = PAGES.filter((p) => {
      if (rel(p) === "layout.tsx") return false;
      return /"@type":\s*"(LocalBusiness|TaxiService|LimousineBusiness)"/.test(read(p));
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it("every page that names a provider points it at the one business node", () => {
    const providers = PAGES.filter((p) => /provider:/.test(read(p)));
    expect(providers.length).toBeGreaterThan(5);
    for (const p of providers) {
      const src = read(p);
      // Window rather than brace matching: the reference is often written as a
      // template literal, `{ "@id": `${BASE}/#business` }`, and a naive
      // [^}]* stops at the ${BASE} brace before reaching the id.
      for (const m of src.matchAll(/provider:/g)) {
        const window = src.slice(m.index, m.index + 160);
        expect(window, `${rel(p)} provider`).toMatch(/#business/);
      }
    }
  });
});

describe("no page claims a language the site does not publish", () => {
  /**
   * The site publishes eight locales. Catalan is not one of them, and neither
   * is any language absent from SUPPORTED_LOCALES. Claiming one in structured
   * data is a factual error a competitor can report and a customer can catch.
   */
  it("does not offer Catalan anywhere in structured data", () => {
    const offenders = PAGES.filter((p) => {
      const src = read(p);
      // "Catalan coast" and "Catalan Pyrenees" are geography, not a language claim.
      return /availableLanguage[^\]]*Catalan|knowsLanguage[^\]]*Catalan|"Catalan"\s*[,\]]/.test(src);
    }).map(rel);
    expect(offenders).toEqual([]);
  });

  it("the layout derives knowsLanguage from SUPPORTED_LOCALES rather than a list", () => {
    const layout = read(join(APP, "layout.tsx"));
    expect(layout).toMatch(/knowsLanguage:\s*\[\.\.\.SUPPORTED_LOCALES\]/);
    expect(SUPPORTED_LOCALES).not.toContain("ca");
  });
});

describe("commercial route pages carry safe, complete markup", () => {
  const ROUTE_PAGES = fg
    .sync("transfers/*/page.tsx", { cwd: APP, absolute: true })
    .filter((p) => !p.includes("[slug]"));

  it("none publishes an aggregateRating or a Review", () => {
    const offenders = ROUTE_PAGES.filter((p) =>
      /aggregateRating|"@type":\s*"Review"/.test(read(p)),
    ).map(rel);
    expect(offenders).toEqual([]);
  });

  it("every one declares a BreadcrumbList, directly or through its template", () => {
    // Delegation is not absence. castelldefels, figueres, salou and tossa-de-mar
    // render through DestinationTemplate, which builds the breadcrumb with
    // breadcrumbSchema(); the four new pages get theirs from route-landings.
    // A first pass at this test read only the page file and reported all eight
    // as missing markup they in fact emit.
    const DELEGATES = ["@/lib/route-landings", "DestinationTemplate"];
    const missing = ROUTE_PAGES.filter((p) => {
      const src = read(p);
      if (DELEGATES.some((d) => src.includes(d))) return false;
      return !/BreadcrumbList/.test(src);
    }).map(rel);
    expect(missing).toEqual([]);
  });

  it("both shared templates emit a breadcrumb, since pages delegate it to them", () => {
    const tpl = readFileSync(
      join(process.cwd(), "components", "transfers", "DestinationTemplate.tsx"),
      "utf-8",
    );
    expect(tpl).toMatch(/breadcrumb:\s*breadcrumbSchema\(/);
    const landing = readFileSync(
      join(process.cwd(), "components", "transfers", "RouteLanding.tsx"),
      "utf-8",
    );
    expect(landing).toMatch(/breadcrumbSchema/);
  });
});
