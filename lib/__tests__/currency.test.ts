import { describe, it, expect } from "vitest";
import { parseEcbXml, type RateTable } from "@/lib/currency/rates";
import {
  convertFromEur,
  formatMoney,
  displayPrice,
  resolveDisplayCurrency,
} from "@/lib/currency";

const ECB_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01">
  <Cube>
    <Cube time='2026-08-07'>
      <Cube currency='USD' rate='1.0856'/>
      <Cube currency='GBP' rate='0.8412'/>
      <Cube currency='CHF' rate='0.9331'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

const TABLE: RateTable = { base: "EUR", rates: { EUR: 1, USD: 1.0856, GBP: 0.8412 }, date: "2026-08-07" };

describe("parseEcbXml", () => {
  it("extracts the publication date and rates", () => {
    const t = parseEcbXml(ECB_SAMPLE);
    expect(t?.date).toBe("2026-08-07");
    expect(t?.rates.GBP).toBeCloseTo(0.8412);
    expect(t?.rates.USD).toBeCloseTo(1.0856);
    expect(t?.rates.EUR).toBe(1);
  });

  it("returns null for junk rather than an empty table", () => {
    expect(parseEcbXml("")).toBeNull();
    expect(parseEcbXml("<html>503 Service Unavailable</html>")).toBeNull();
    // Well-formed envelope, no rates in it.
    expect(parseEcbXml(`<Cube time='2026-08-07'></Cube>`)).toBeNull();
  });
});

describe("convertFromEur", () => {
  it("converts using the table", () => {
    expect(convertFromEur(50, "GBP", TABLE)).toBeCloseTo(42.06);
    expect(convertFromEur(50, "USD", TABLE)).toBeCloseTo(54.28);
  });

  it("passes EUR through untouched even with no table", () => {
    expect(convertFromEur(50, "EUR", null)).toBe(50);
  });

  it("returns null rather than guessing when the rate is unavailable", () => {
    expect(convertFromEur(50, "GBP", null)).toBeNull();
    expect(convertFromEur(50, "GBP", { base: "EUR", rates: { EUR: 1 }, date: "x" })).toBeNull();
  });
});

describe("formatMoney", () => {
  it("renders exact EUR without an approximation marker", () => {
    expect(formatMoney(50, "EUR")).toBe("€50");
    expect(formatMoney(65.5, "EUR")).toBe("€65.50");
  });

  it("marks converted amounts as approximate and rounds to a whole unit", () => {
    // Showing £42.06 would imply a precision the daily reference rate lacks,
    // and imply that is the sum leaving the account -- it is not.
    expect(formatMoney(42.06, "GBP", true)).toBe("≈£42");
    expect(formatMoney(54.28, "USD", true)).toBe("≈$54");
  });
});

describe("displayPrice", () => {
  it("always carries the EUR figure that is actually charged", () => {
    const p = displayPrice(50, "GBP", TABLE);
    expect(p.eur).toBe("€50");
    expect(p.converted).toBe("≈£42");
  });

  it("has no converted figure when showing EUR", () => {
    expect(displayPrice(50, "EUR", TABLE).converted).toBeNull();
  });

  it("degrades to EUR-only when rates are unavailable", () => {
    const p = displayPrice(50, "USD", null);
    expect(p.eur).toBe("€50");
    expect(p.converted).toBeNull();
  });
});

describe("resolveDisplayCurrency", () => {
  it("accepts supported currencies in any case", () => {
    expect(resolveDisplayCurrency("gbp")).toBe("GBP");
    expect(resolveDisplayCurrency("USD")).toBe("USD");
  });

  it("falls back to EUR for anything else", () => {
    expect(resolveDisplayCurrency("JPY")).toBe("EUR");
    expect(resolveDisplayCurrency(null)).toBe("EUR");
    expect(resolveDisplayCurrency("")).toBe("EUR");
  });
});
