import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const auth = vi.hoisted(() => ({ role: "ADMIN" as string | null }));
vi.mock("@/lib/whatsapp-admin", () => ({ requireAdmin: async () => (auth.role === "ADMIN" ? { name: "Sam" } : null) }));

import { getWhatsAppCatalog, setWhatsAppCatalog } from "@/lib/whatsapp";
import { GET, POST } from "@/app/api/admin/whatsapp/catalog-visibility/route";

/**
 * The catalogue has its own switch on the WhatsApp number. Connecting it to the
 * business account is not enough: until the number's switch is on, customers
 * see no shop icon. These check the requests sent to Meta, and that only an
 * admin can flip it.
 */

const fetchMock = vi.fn();
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: (init ?? {}) as RequestInit & { headers: Record<string, string> } }));
const ok = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const fail = (code: number, message = "nope") => {
  const body = { error: { code, message } };
  return { ok: false, status: 400, json: async () => body, text: async () => JSON.stringify(body) };
};
const settings = (visible: boolean, cart = false) => ok({ data: [{ id: "1", is_catalog_visible: visible, is_cart_enabled: cart }] });
const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  auth.role = "ADMIN";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WA_PHONE_ID", "PHONE1");
  vi.stubEnv("WA_TOKEN", "TOKEN1");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("getWhatsAppCatalog", () => {
  it("reads the number's own commerce settings with the token", async () => {
    fetchMock.mockResolvedValueOnce(settings(true)).mockResolvedValueOnce(ok({ data: [{ id: "1132730822660141", name: "Elite BCN Transfers" }] }));
    expect(await getWhatsAppCatalog()).toEqual({ ok: true, state: { visible: true, cartEnabled: false, catalogs: [{ id: "1132730822660141", name: "Elite BCN Transfers" }] } });
    expect(calls()[1].url).toBe("https://graph.facebook.com/v21.0/2114337302504279/product_catalogs?fields=id,name");
    expect(calls()[0].url).toBe("https://graph.facebook.com/v21.0/PHONE1/whatsapp_commerce_settings");
    expect(calls()[0].init.headers.Authorization).toBe("Bearer TOKEN1");
  });

  it("is off when Meta says nothing, which is how a number that was never set up looks", async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    expect(await getWhatsAppCatalog()).toEqual({ ok: true, state: { visible: false, cartEnabled: false, catalogs: [] } });
  });

  it("still reports the switch when the list of connected catalogues cannot be read", async () => {
    fetchMock.mockResolvedValueOnce(settings(true)).mockResolvedValueOnce(fail(10));
    expect(await getWhatsAppCatalog()).toMatchObject({ ok: true, state: { visible: true, catalogs: [] } });
  });

  it("says why it could not check, and never throws", async () => {
    fetchMock.mockResolvedValue(fail(190));
    expect(await getWhatsAppCatalog()).toMatchObject({ ok: false, reason: expect.stringContaining("token") });
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await getWhatsAppCatalog()).toEqual({ ok: false, reason: "offline" });
    vi.stubEnv("WA_TOKEN", "");
    expect(await getWhatsAppCatalog()).toMatchObject({ ok: false });
  });
});

describe("setWhatsAppCatalog", () => {
  it("switches the catalogue on and leaves the cart off", async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));
    expect(await setWhatsAppCatalog(true)).toEqual({ ok: true });
    const [c] = calls();
    expect(c.init.method).toBe("POST");
    expect(c.url).toBe("https://graph.facebook.com/v21.0/PHONE1/whatsapp_commerce_settings?is_catalog_visible=true&is_cart_enabled=false");
  });

  it("can switch it off again", async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));
    await setWhatsAppCatalog(false);
    expect(calls()[0].url).toContain("is_catalog_visible=false");
  });

  it("reports Meta's refusal in plain words", async () => {
    fetchMock.mockResolvedValue(fail(100, "No catalog connected"));
    expect(await setWhatsAppCatalog(true)).toMatchObject({ ok: false, reason: expect.stringContaining("No catalog connected") });
  });
});

describe("the catalogue route", () => {
  it("is for admins only", async () => {
    for (const role of [null, "DRIVER", "CUSTOMER"]) {
      auth.role = role;
      expect((await GET()).status).toBe(401);
      expect((await POST(post({ visible: true }))).status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports where the switch stands", async () => {
    fetchMock.mockResolvedValueOnce(settings(false)).mockResolvedValueOnce(ok({ data: [] }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ visible: false, cartEnabled: false, catalogs: [] });
  });

  it("switches it on, then reports the new state read back from Meta", async () => {
    fetchMock.mockResolvedValueOnce(ok({ success: true })).mockResolvedValueOnce(settings(true)).mockResolvedValueOnce(ok({ data: [] }));
    const res = await POST(post({ visible: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ visible: true, cartEnabled: false, catalogs: [] });
    expect(calls()[0].init.method).toBe("POST");
  });

  it("refuses a request that does not say what to do, without calling Meta", async () => {
    for (const body of [{}, { visible: "yes" }, null]) expect((await POST(post(body))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes on Meta's reason when it refuses", async () => {
    fetchMock.mockResolvedValue(fail(100, "No catalog connected"));
    const res = await POST(post({ visible: true }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("No catalog connected");
  });
});
