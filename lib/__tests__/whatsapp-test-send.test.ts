import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ admin: true, send: vi.fn() }));
vi.mock("@/lib/whatsapp-admin", () => ({ requireAdmin: async () => (m.admin ? { name: "Sam" } : null) }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppTemplate: m.send }));

import { POST } from "@/app/api/admin/whatsapp/test/route";
import { TEMPLATE_DEFS } from "@/lib/whatsapp-template-defs";

const post = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => { m.admin = true; m.send.mockReset(); m.send.mockResolvedValue({ outcome: "sent", id: "wamid.1" }); });

describe("the WhatsApp test send", () => {
  it("is for admins only", async () => {
    m.admin = false;
    expect((await post({ phone: "+34635383712" })).status).toBe(401);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("refuses a number with no country code", async () => {
    expect((await post({ phone: "635383712" })).status).toBe(422);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("sends the confirmation, driver-assigned and flight-delay templates with every field filled", async () => {
    const res = await post({ phone: "+34 635 383 712" });
    expect(res.status).toBe(200);
    expect(m.send).toHaveBeenCalledTimes(3);
    for (const [to, name, fields] of m.send.mock.calls) {
      expect(to).toBe("+34635383712");
      const def = TEMPLATE_DEFS.find((t) => t.name === name)!;
      expect(fields).toHaveLength(def.fields.length);
      expect(fields.every((f: string) => f && f.length > 0)).toBe(true);
    }
    expect(m.send.mock.calls.map((c) => c[1])).toEqual(["elitebcn_booking_confirmation", "elitebcn_driver_assigned", "flight_delayed"]);
  });
});
