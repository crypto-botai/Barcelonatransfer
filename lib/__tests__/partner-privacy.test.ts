import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  session: null as unknown,
  partner: { id: "pp1" } as { id: string } | null,
  booking: { id: "b1", userId: "u1", driverId: "d1", partnerId: "pp1", guestName: "Ana", confirmationCode: "EBC-1", isDeleted: false } as Record<string, unknown>,
  messages: [] as Record<string, unknown>[],
  created: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: async () => m.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/notifications/service", () => ({ notify: m.notify }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findUnique: async () => m.booking },
    fleetPartner: { findUnique: async () => m.partner },
    driver: { findUnique: async () => ({ id: "d1" }) },
    tripMessage: {
      findMany: async () => m.messages,
      create: async ({ data }: { data: Record<string, unknown> }) => { m.created(data); return { id: "m1", createdAt: new Date(), ...data }; },
    },
  },
}));

import { PARTNER_PUBLIC_NAME, identifyParticipant, listMessages, postMessage, publicSenderName } from "@/lib/trip-chat";

/**
 * The customer booked Elite BCN. The company that supplies the chauffeur is not
 * part of what they were sold, so its name must not reach them: not in the
 * assigned-driver email, not in the trip chat, not in the alert on their phone.
 */

const rd = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

beforeEach(() => {
  m.session = { user: { id: "partner-user", role: "PARTNER", name: "Ines" } };
  m.partner = { id: "pp1" };
  m.messages = [];
  m.created.mockReset();
  m.notify.mockReset();
  m.notify.mockResolvedValue(undefined);
});

describe("the trip chat", () => {
  it("shows a company's messages as Elite BCN, whatever name was stored with them", () => {
    expect(publicSenderName("PARTNER", "Aerogate Travel SL")).toBe(PARTNER_PUBLIC_NAME);
    expect(PARTNER_PUBLIC_NAME).toBe("Elite BCN");
  });

  it("leaves the chauffeur's, the customer's and the office's names alone", () => {
    expect(publicSenderName("DRIVER", "Ayaz")).toBe("Ayaz");
    expect(publicSenderName("CUSTOMER", "Ana")).toBe("Ana");
    expect(publicSenderName("ADMIN", "Elite BCN")).toBe("Elite BCN");
  });

  it("does not take the company's name when it writes", async () => {
    const me = await identifyParticipant("b1");
    expect(me).toEqual({ sender: "PARTNER", name: "Elite BCN", bookingId: "b1" });
  });

  it("hides the company name on messages written before this rule", async () => {
    m.messages = [
      { id: "1", sender: "PARTNER", senderName: "Aerogate Travel SL", body: "On our way", createdAt: new Date() },
      { id: "2", sender: "DRIVER", senderName: "Ayaz", body: "Hello", createdAt: new Date() },
      { id: "3", sender: "CUSTOMER", senderName: "Ana", body: "Thanks", createdAt: new Date() },
    ];
    const out = await listMessages("b1");
    expect(out.map((x) => x.senderName)).toEqual(["Elite BCN", "Ayaz", "Ana"]);
    expect(JSON.stringify(out)).not.toContain("Aerogate");
  });

  it("stores, returns and pushes a company's message under Elite BCN", async () => {
    const me = await identifyParticipant("b1");
    const msg = await postMessage(me!, "Your driver is five minutes away");
    expect(m.created.mock.calls[0][0].senderName).toBe("Elite BCN");
    expect(msg.senderName).toBe("Elite BCN");
    const alert = m.notify.mock.calls.find(([c]) => c.userId === "u1")![0];
    expect(alert.vars.from).toBe("Elite BCN");
    expect(JSON.stringify(m.notify.mock.calls)).not.toContain("Aerogate");
  });

  it("still refuses a company that did not dispatch this job", async () => {
    m.partner = { id: "someone-else" };
    expect(await identifyParticipant("b1")).toBeNull();
  });
});

describe("what the customer is sent when a company's driver is assigned", () => {
  const partner = rd("lib/partner.ts");
  const dispatch = partner.slice(partner.indexOf("export async function dispatchPartnerJob"), partner.indexOf("export async function undispatchPartnerJob"));

  it("is the same card an office driver triggers: the chauffeur, his phone, the car, the plate", () => {
    const call = dispatch.slice(dispatch.indexOf("sendDriverAssignedEmail({"), dispatch.indexOf("}).catch", dispatch.indexOf("sendDriverAssignedEmail({")));
    for (const field of ["driverName", "driverPhone", "vehicleMake", "licensePlate", "pickupDatetime"]) expect(call).toContain(field);
    expect(call).not.toMatch(/partner|company/i);
  });

  it("tells the customer's phone and inbox the chauffeur's name only", () => {
    const customerNotify = dispatch.slice(dispatch.indexOf('event: "DRIVER_ASSIGNED"'), dispatch.indexOf('event: "DRIVER_NEW_JOB"'));
    expect(customerNotify).toContain("driver: driverName");
    expect(customerNotify).not.toMatch(/partner|company/i);
  });

  it("the email template has no place for a company name", () => {
    const premium = rd("lib/email/premium.ts");
    const card = premium.slice(premium.indexOf("export function driverAssignedCard"), premium.indexOf("// ─── 5. Payment receipt"));
    expect(card).not.toMatch(/partner|company|fleet/i);
    const resend = rd("lib/resend.ts");
    const send = resend.slice(resend.indexOf("export async function sendDriverAssignedEmail"), resend.indexOf("// ─── Review Request"));
    expect(send).not.toMatch(/partner|company|fleet/i);
  });
});
