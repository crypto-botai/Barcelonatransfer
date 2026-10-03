import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/destination-pricing", () => ({ getDestinationPrices: vi.fn().mockResolvedValue(null) }));

import {
  CHOICE_PREFIX, buildServiceLink, buildServicesMenu, catalogCsv, parseServiceChoice, resolveServices,
} from "@/lib/whatsapp-services";
import { DEFAULT_SERVICES, LIMITS, type ServiceItem } from "@/lib/whatsapp-settings";

/**
 * The services menu, the Book button and the catalogue feed.
 *
 * Prices are looked up, never typed into the code, so these use a stand-in for
 * the price table and check that what is sent is exactly what it returned, and
 * that nothing sent breaks WhatsApp's own limits.
 */

const TABLE: Record<string, number> = { barcelona_city: 50, tossa: 155, girona_city: 165, lloret: 145, sitges: 80, hourly: 45 };
const lookup = async (zone: string) => TABLE[zone] ?? null;

describe("resolveServices", () => {
  it("quotes each service from the price table", async () => {
    const out = await resolveServices(DEFAULT_SERVICES, lookup);
    const price = (id: string) => out.find((s) => s.id === id)?.fromPrice;
    expect(price("airport-to-city")).toBe(50);
    expect(price("city-to-airport")).toBe(50);
    expect(price("tossa-de-mar")).toBe(155);
    expect(price("girona")).toBe(165);
    expect(price("lloret-de-mar")).toBe(145);
    expect(price("sitges")).toBe(80);
  });

  it("prices by the hour at the hourly rate and says so", async () => {
    const hourly = (await resolveServices(DEFAULT_SERVICES, lookup)).find((s) => s.id === "per-hour")!;
    expect(hourly.unit).toBe("hour");
    expect(hourly.fromPrice).toBe(45);
    expect(hourly.line).toMatch(/€45\/hour/);
    expect(hourly.line).toMatch(/4h minimum/);
  });

  it("a typed price beats the table", async () => {
    const [s] = await resolveServices([{ ...DEFAULT_SERVICES[0], manualFrom: 60 }], lookup);
    expect(s.fromPrice).toBe(60);
    expect(s.line).toContain("€60");
  });

  it("never invents a price: no table row and no typed price means none", async () => {
    const [s] = await resolveServices([{ ...DEFAULT_SERVICES[0], zone: "atlantis" }], lookup);
    expect(s.fromPrice).toBeNull();
    expect(s.line).not.toMatch(/€/);
  });

  it("survives the price lookup failing", async () => {
    const [s] = await resolveServices([DEFAULT_SERVICES[0]], async () => { throw new Error("db down"); });
    expect(s.fromPrice).toBeNull();
  });

  it("uses the written description when there is one, within the limit", async () => {
    const [s] = await resolveServices([{ ...DEFAULT_SERVICES[0], description: "x".repeat(200) }], lookup);
    expect(s.line).toHaveLength(LIMITS.description);
  });

  it("builds absolute links to our own site", async () => {
    const [s] = await resolveServices([DEFAULT_SERVICES[3]], lookup);
    expect(s.url).toMatch(/^https:\/\/www\.elitebcn\.info\/transfers\/tossa-de-mar$/);
    expect(s.imageUrl).toMatch(/^https:\/\/www\.elitebcn\.info\/whatsapp\/tossa-de-mar\.jpg$/);
  });

  it("formats a fractional price with cents", async () => {
    const [s] = await resolveServices([{ ...DEFAULT_SERVICES[0], manualFrom: 49.5 }], lookup);
    expect(s.line).toContain("€49.50");
  });
});

describe("buildServicesMenu", () => {
  it("is a WhatsApp list, within every limit Meta enforces", async () => {
    const menu = buildServicesMenu(await resolveServices(DEFAULT_SERVICES, lookup)) as {
      type: string; header: { text: string }; body: { text: string }; footer: { text: string };
      action: { button: string; sections: { title: string; rows: { id: string; title: string; description: string }[] }[] };
    };
    expect(menu.type).toBe("list");
    expect(menu.header.text.length).toBeLessThanOrEqual(60);
    expect(menu.body.text.length).toBeLessThanOrEqual(1024);
    expect(menu.footer.text.length).toBeLessThanOrEqual(60);
    expect(menu.action.button.length).toBeLessThanOrEqual(20);
    const rows = menu.action.sections.flatMap((s) => s.rows);
    expect(rows).toHaveLength(7);
    expect(rows.length).toBeLessThanOrEqual(10);
    for (const r of rows) {
      expect(r.title.length).toBeLessThanOrEqual(24);
      expect(r.description.length).toBeLessThanOrEqual(72);
      expect(r.id.length).toBeLessThanOrEqual(200);
      expect(r.id.startsWith(CHOICE_PREFIX)).toBe(true);
    }
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it("leaves out services that are switched off", async () => {
    const items: ServiceItem[] = DEFAULT_SERVICES.map((s, i) => ({ ...s, enabled: i < 2 }));
    const menu = buildServicesMenu(await resolveServices(items, lookup)) as { action: { sections: { rows: unknown[] }[] } };
    expect(menu.action.sections[0].rows).toHaveLength(2);
  });

  it("is null when nothing is on, so nothing empty is sent", async () => {
    expect(buildServicesMenu(await resolveServices(DEFAULT_SERVICES.map((s) => ({ ...s, enabled: false })), lookup))).toBeNull();
    expect(buildServicesMenu([])).toBeNull();
  });
});

describe("parseServiceChoice", () => {
  it("reads the id back from a row id", () => expect(parseServiceChoice("svc:girona")).toBe("girona"));
  it.each([null, undefined, "", "other:girona", "girona"])("ignores %s", (v) => expect(parseServiceChoice(v)).toBeNull());
});

describe("buildServiceLink", () => {
  it("is a link button with the picture, the price and our own address", async () => {
    const [tossa] = await resolveServices([DEFAULT_SERVICES[3]], lookup);
    const m = buildServiceLink(tossa) as {
      type: string; header: { type: string; image: { link: string } }; body: { text: string };
      action: { name: string; parameters: { display_text: string; url: string } };
    };
    expect(m.type).toBe("cta_url");
    expect(m.header.image.link).toBe(tossa.imageUrl);
    expect(m.body.text).toContain("from €155");
    expect(m.body.text.length).toBeLessThanOrEqual(1024);
    expect(m.action.name).toBe("cta_url");
    expect(m.action.parameters.display_text.length).toBeLessThanOrEqual(20);
    expect(m.action.parameters.url).toBe(tossa.url);
  });

  it("says per hour for hourly hire and never quotes a missing price", async () => {
    const [hourly] = await resolveServices([DEFAULT_SERVICES[2]], lookup);
    expect((buildServiceLink(hourly) as { body: { text: string } }).body.text).toContain("from €45 per hour");
    const [none] = await resolveServices([{ ...DEFAULT_SERVICES[0], zone: "atlantis" }], lookup);
    const text = (buildServiceLink(none) as { body: { text: string } }).body.text;
    expect(text).toContain("priced when you book");
    expect(text).not.toMatch(/€\d/);
  });
});

describe("catalogCsv", () => {
  const parse = (csv: string) => csv.trim().split("\n");

  it("has the columns Meta requires, and one line per priced service", async () => {
    const lines = parse(catalogCsv(await resolveServices(DEFAULT_SERVICES, lookup)));
    expect(lines[0]).toBe("id,title,description,availability,condition,price,link,image_link,brand");
    expect(lines).toHaveLength(8);
  });

  it("formats prices the way the catalogue wants", async () => {
    const csv = catalogCsv(await resolveServices(DEFAULT_SERVICES, lookup));
    expect(csv).toContain("50.00 EUR");
    expect(csv).toContain("155.00 EUR");
    expect(csv).toContain("45.00 EUR");
  });

  it("leaves out a service with no price instead of listing it at zero", async () => {
    const csv = catalogCsv(await resolveServices([DEFAULT_SERVICES[0], { ...DEFAULT_SERVICES[1], zone: "atlantis" }], lookup));
    expect(parse(csv)).toHaveLength(2);
    expect(csv).not.toContain("city-to-airport");
  });

  it("leaves out services switched off", async () => {
    const csv = catalogCsv(await resolveServices([{ ...DEFAULT_SERVICES[0], enabled: false }], lookup));
    expect(parse(csv)).toHaveLength(1);
  });

  it("quotes cells that contain commas or quotes, so a title cannot break the columns", async () => {
    const csv = catalogCsv(await resolveServices([{ ...DEFAULT_SERVICES[0], title: 'City, "Centre" transfer', description: "" }], lookup));
    expect(csv).toContain('"City, ""Centre"" transfer"');
    // Still the same number of columns on the data row once quoted cells are respected.
    const cells = parse(csv)[1].match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.filter((c) => c !== "");
    expect(cells).toHaveLength(9);
  });

  it("names a destination as a product, and keeps route names as they are", async () => {
    const csv = catalogCsv(await resolveServices(DEFAULT_SERVICES, lookup));
    expect(csv).toContain("Airport transfer to Tossa de Mar");
    expect(csv).toContain("Airport to City");
    expect(csv).toContain("Chauffeur per hour");
  });

  it("links to our own site and uses real picture addresses", async () => {
    const csv = catalogCsv(await resolveServices(DEFAULT_SERVICES, lookup));
    for (const l of parse(csv).slice(1)) {
      expect(l).toMatch(/https:\/\/www\.elitebcn\.info\/[a-z\-/]+/);
      expect(l).toMatch(/https:\/\/www\.elitebcn\.info\/whatsapp\/[a-z\-]+\.jpg/);
    }
  });
});
