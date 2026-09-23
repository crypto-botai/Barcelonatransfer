import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The field the whole booking rests on.
 *
 * Nothing downstream recovers from this one being wrong. The quote geocodes
 * whatever text is in it, so a customer who could not find their destination
 * did not get a worse price: they got no price, and a "contact us on WhatsApp"
 * that mostly went unsent. lib/geo fixed the searching; this guards the half
 * that is the list itself.
 */

const ROOT = join(__dirname, "..", "..");
const picker = readFileSync(join(ROOT, "components/booking/AddressAutocomplete.tsx"), "utf-8");
const proxy  = readFileSync(join(ROOT, "app/api/geo/search/route.ts"), "utf-8");

describe("the address picker can be used without a mouse", () => {
  /**
   * It could not be, at all. No key did anything: a keyboard user, and anyone
   * typing an address at speed, had to reach for the pointer to choose a row.
   */
  it("moves through the list with the arrow keys and chooses with Enter", () => {
    expect(picker).toContain('e.key === "ArrowDown"');
    expect(picker).toContain('e.key === "ArrowUp"');
    expect(picker).toContain('e.key === "Enter"');
    expect(picker).toContain('e.key === "Escape"');
  });

  it("wraps at both ends rather than stopping dead", () => {
    expect(picker).toContain("(i + step + rows.length) % rows.length");
  });

  it("walks the rows that are actually on screen", () => {
    // Zones, recents and results are three different lists in the same slot.
    // A keyboard that only ever walked the results would do nothing while the
    // fixed-price zones were showing.
    expect(picker).toContain("const rows = useMemo(");
    expect(picker).toContain("if (showZones && quickZones) return quickZones.map");
    expect(picker).toContain("if (showRecents) return recents.map");
  });

  it("announces itself to a screen reader as a combobox over a listbox", () => {
    expect(picker).toContain('role="combobox"');
    expect(picker).toContain("aria-expanded={hasDropdown}");
    expect(picker).toContain('aria-autocomplete="list"');
    expect(picker).toContain("aria-activedescendant=");
    expect(picker).toContain('role="listbox"');
    expect(picker).toContain('role="option"');
    expect(picker).toContain("aria-selected={i === active}");
  });

  it("keeps the highlighted row in view", () => {
    expect(picker).toContain('scrollIntoView({ block: "nearest" })');
  });
});

describe("what a row shows", () => {
  /**
   * The old row printed Nominatim's display_name whole. For the airport that
   * is ninety characters of administrative hierarchy ending in "España",
   * truncated mid-string, so every airport suggestion looked identical.
   */
  it("is two lines: the place, then just enough to tell it apart", () => {
    expect(picker).toContain("{s.name ?? s.label}");
    expect(picker).toContain("{s.context && <p");
  });

  it("carries an icon for the kind of place it is", () => {
    expect(picker).toContain("KIND_ICON");
    for (const kind of ["airport", "train", "port", "hotel", "city", "landmark", "address"]) {
      expect(picker, kind).toContain(`${kind}:`);
    }
  });

  it("highlights the typed part, ignoring accents", () => {
    // So "sagrada famili" visibly matches inside "Sagrada Família".
    expect(picker).toContain("function Highlight(");
    expect(picker).toContain('normalize("NFD")');
  });
});

describe("the states around the list", () => {
  it("shows the shape of an answer while loading, not a spinner over nothing", () => {
    expect(picker).toContain("animate-pulse");
  });

  /** An empty dropdown with no explanation reads as a broken form. */
  it("says what to try when nothing matches, and that typing it still works", () => {
    expect(picker).toContain("Nothing found for");
    expect(picker).toContain("we will still price the journey");
  });

  it("offers somewhere they picked before", () => {
    expect(picker).toContain("RECENTS_KEY");
    expect(picker).toContain("MAX_RECENTS");
    // Storage is blocked in private windows; a booking must not depend on it.
    expect(picker).toContain("catch {");
  });

  it("respects a reduced-motion preference", () => {
    expect(picker).toContain("useReducedMotion");
  });
});

describe("the requests behind it", () => {
  /** "T1" and "BCN" are both things a customer types. Both were ignored. */
  it("searches from two characters, on the client and at the proxy", () => {
    expect(picker).toContain("q.trim().length < 2");
    expect(proxy).toContain("q.length < 2");
  });

  it("does not let a slow early keystroke overwrite a newer answer", () => {
    expect(picker).toContain("const mine = ++requestId.current");
    expect(picker).toContain("if (mine !== requestId.current) return");
  });

  it("still clears the coordinates when the text is edited", () => {
    // The server geocodes the typed address when none arrive, which is what
    // lets someone who never opens the list get a price at all.
    expect(picker).toContain("onChange({ address: q, lat: 0, lng: 0 })");
  });
});
