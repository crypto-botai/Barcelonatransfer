import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  vatBreakdown,
  formatInvoiceNumber,
  isIssuerComplete,
  missingIssuerFields,
  isValidSpanishTaxId,
  getIssuer,
  VAT_RATE,
} from "@/lib/invoices";

describe("VAT breakdown", () => {
  it("adds 10% to a VAT-exclusive fare", () => {
    // The site quotes excluding VAT, so the fare is the net figure and VAT is
    // added on top -- not extracted from within it.
    expect(vatBreakdown(50)).toEqual({ net: 50, vat: 5, gross: 55, rate: 10 });
    expect(vatBreakdown(80)).toEqual({ net: 80, vat: 8, gross: 88, rate: 10 });
  });

  it("uses the Spanish reduced rate for passenger transport", () => {
    expect(VAT_RATE).toBe(10);
  });

  it("rounds to cents without drifting", () => {
    const b = vatBreakdown(81);
    expect(b.vat).toBe(8.1);
    expect(b.gross).toBe(89.1);
    expect(Math.round((b.net + b.vat) * 100) / 100).toBe(b.gross);
  });

  it("keeps net + vat === gross across many awkward fares", () => {
    for (let fare = 50; fare <= 700; fare += 7) {
      const b = vatBreakdown(fare);
      expect(Math.round((b.net + b.vat) * 100) / 100, `fare ${fare}`).toBe(b.gross);
    }
  });
});

describe("invoice numbering", () => {
  it("formats as series-year-sequence, zero padded", () => {
    expect(formatInvoiceNumber("A", 2026, 1)).toBe("A-2026-0001");
    expect(formatInvoiceNumber("A", 2026, 47)).toBe("A-2026-0047");
    expect(formatInvoiceNumber("A", 2026, 1234)).toBe("A-2026-1234");
  });

  it("does not truncate once past four digits", () => {
    expect(formatInvoiceNumber("A", 2026, 12345)).toBe("A-2026-12345");
  });
});

describe("Spanish tax number validation", () => {
  it("accepts the configured company NIF", () => {
    // Nouman Nawaz Nazli, autónomo. 61761066 % 23 = 17 -> "V".
    expect(isValidSpanishTaxId("ES61761066V")).toBe(true);
    expect(isValidSpanishTaxId("61761066V")).toBe(true);
    expect(isValidSpanishTaxId("es-61761066-v")).toBe(true);
  });

  it("rejects a wrong check letter", () => {
    // A transposed digit or a mistyped letter looks perfectly normal but makes
    // every invoice issued against it invalid.
    expect(isValidSpanishTaxId("ES61761066A")).toBe(false);
    expect(isValidSpanishTaxId("ES61761065V")).toBe(false);
    expect(isValidSpanishTaxId("ES61716066V")).toBe(false);
  });

  it("validates NIE numbers for foreign residents", () => {
    expect(isValidSpanishTaxId("X1234567L")).toBe(true);
    expect(isValidSpanishTaxId("X1234567A")).toBe(false);
  });

  it("accepts a well-formed company CIF", () => {
    expect(isValidSpanishTaxId("B12345678")).toBe(true);
  });

  it("rejects nonsense", () => {
    expect(isValidSpanishTaxId("")).toBe(false);
    expect(isValidSpanishTaxId("12345")).toBe(false);
    expect(isValidSpanishTaxId("NOT-A-NIF")).toBe(false);
  });
});

describe("issuer details", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is incomplete without a tax id and address", () => {
    // A Spanish invoice is not valid without the issuer's NIF/CIF. These are
    // business registration facts, so the code refuses to invent them.
    vi.stubEnv("COMPANY_TAX_ID", "");
    vi.stubEnv("COMPANY_ADDRESS", "");
    expect(isIssuerComplete(getIssuer())).toBe(false);
  });

  it("is complete once both are configured", () => {
    vi.stubEnv("COMPANY_TAX_ID", "ES61761066V");
    vi.stubEnv("COMPANY_ADDRESS", "Carrer Example 1, 08001 Barcelona");
    expect(isIssuerComplete(getIssuer())).toBe(true);
  });

  it("treats an invalid tax number as incomplete, not merely present", () => {
    // Worse than missing: the invoice would look finished while being invalid.
    vi.stubEnv("COMPANY_TAX_ID", "ES61761066A");
    vi.stubEnv("COMPANY_ADDRESS", "Carrer Example 1, 08001 Barcelona");
    expect(isIssuerComplete(getIssuer())).toBe(false);
    expect(missingIssuerFields(getIssuer())[0]).toMatch(/check character/);
  });

  it("names exactly what is missing", () => {
    vi.stubEnv("COMPANY_TAX_ID", "ES61761066V");
    vi.stubEnv("COMPANY_ADDRESS", "");
    expect(missingIssuerFields(getIssuer())).toEqual(["registered address"]);
  });

  it("carries a trading name separately from the legal name", () => {
    // For an autónomo the legal name is the individual; the brand is the
    // nombre comercial and cannot replace it on the document.
    vi.stubEnv("COMPANY_LEGAL_NAME", "Nouman Nawaz Nazli");
    vi.stubEnv("COMPANY_TRADE_NAME", "elitebcn.info");
    const i = getIssuer();
    expect(i.legalName).toBe("Nouman Nawaz Nazli");
    expect(i.tradeName).toBe("elitebcn.info");
  });

  it("never fabricates a tax number", () => {
    vi.stubEnv("COMPANY_TAX_ID", "");
    expect(getIssuer().taxId).toBeNull();
  });
});

// --- issuing -------------------------------------------------------------

const invoices: any[] = [];
let bookingRow: any = { id: "bk1", totalAmount: 80, paymentStatus: "PAID" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: {
      findUnique: vi.fn(async ({ where }: any) => invoices.find((i) => i.bookingId === where.bookingId) ?? null),
      update:     vi.fn(async ({ where, data }: any) => {
        const i = invoices.find((x) => x.bookingId === where.bookingId);
        Object.assign(i, data);
        return i;
      }),
    },
    booking: { findUnique: vi.fn(async () => bookingRow) },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        invoice: {
          findFirst: async ({ where }: any) => {
            const rows = invoices
              .filter((i) => i.series === where.series && i.year === where.year)
              .sort((a, b) => b.number - a.number);
            return rows[0] ?? null;
          },
          create: async ({ data }: any) => { invoices.push(data); return data; },
        },
      }),
    ),
  },
}));

describe("issueInvoice", () => {
  beforeEach(() => { invoices.length = 0; bookingRow = { id: "bk1", totalAmount: 80, paymentStatus: "PAID" }; });

  it("issues sequential numbers with no gaps", async () => {
    const { issueInvoice } = await import("@/lib/invoices");
    const a = await issueInvoice({ bookingId: "bk1", customerName: "A" });
    invoices.length && (bookingRow = { id: "bk2", totalAmount: 50, paymentStatus: "PAID" });
    const b = await issueInvoice({ bookingId: "bk2", customerName: "B" });
    const c = await issueInvoice({ bookingId: "bk3", customerName: "C" });

    expect([a.number, b.number, c.number]).toEqual([1, 2, 3]);
  });

  it("is idempotent — asking twice does not burn a second number", async () => {
    const { issueInvoice } = await import("@/lib/invoices");
    const first  = await issueInvoice({ bookingId: "bk1", customerName: "A" });
    const second = await issueInvoice({ bookingId: "bk1", customerName: "A" });
    expect(second.number).toBe(first.number);
    expect(invoices).toHaveLength(1);
  });

  it("updates tax details on the existing invoice rather than reissuing", async () => {
    const { issueInvoice } = await import("@/lib/invoices");
    await issueInvoice({ bookingId: "bk1", customerName: "A" });
    const updated = await issueInvoice({ bookingId: "bk1", customerName: "A", customerTaxId: "B12345678" });
    expect(updated.customerTaxId).toBe("B12345678");
    expect(invoices).toHaveLength(1);   // number already reported; not replaced
  });

  it("records the VAT split on the invoice", async () => {
    const { issueInvoice } = await import("@/lib/invoices");
    const inv = await issueInvoice({ bookingId: "bk1", customerName: "A" });
    expect(inv.netAmount).toBe(80);
    expect(inv.vatAmount).toBe(8);
    expect(inv.grossAmount).toBe(88);
  });
});
