import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DRIVER_LOGIN_DOMAIN, driverMailTo, generateDriverLogin, isGeneratedLogin } from "@/lib/driver-email";

/**
 * One company inbox, one login each.
 *
 * A fleet company could not put its office address on a second driver: the
 * address was the login, and logins are unique. But a fleet's drivers often
 * have no work email, and the office wants the job sheets and passwords where
 * it can read them. So the login still identifies one driver, because dispatch
 * and the live map depend on telling them apart, and notifyEmail decides where
 * the post goes, which any number of drivers may share.
 */

const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const never = () => false;

describe("where a driver's mail goes", () => {
  it("is their own address when they have one", () => {
    expect(driverMailTo({ notifyEmail: null, user: { email: "marc@example.com" } })).toBe("marc@example.com");
  });

  it("is the company's inbox when one was set", () => {
    expect(driverMailTo({ notifyEmail: "office@vito.com", user: { email: "marc@example.com" } })).toBe("office@vito.com");
  });

  it("falls back rather than sending nowhere when the field is blank", () => {
    expect(driverMailTo({ notifyEmail: "   ", user: { email: "marc@example.com" } })).toBe("marc@example.com");
    expect(driverMailTo({ user: { email: "marc@example.com" } })).toBe("marc@example.com");
  });

  /** Several drivers sharing one inbox is the whole point, not a clash. */
  it("lets a whole fleet share one address", () => {
    const office = "office@vitotransfers.com";
    const fleet = ["marc", "ana", "youssef"].map((n) => ({ notifyEmail: office, user: { email: `${n}@vitotransfers.drivers.elitebcn.info` } }));
    expect(fleet.map(driverMailTo)).toEqual([office, office, office]);
  });
});

describe("a sign-in address for a driver with no email", () => {
  it("reads as the driver's name at the company", () => {
    expect(generateDriverLogin("Marc Puig", "Vito Transfers", never)).toBe(`marc-puig@vito-transfers.${DRIVER_LOGIN_DOMAIN}`);
  });

  it("strips accents so it can be read down a phone", () => {
    expect(generateDriverLogin("José Álvarez", "Añó SL", never)).toBe(`jose-alvarez@ano-sl.${DRIVER_LOGIN_DOMAIN}`);
  });

  it("does not collide when a company has two drivers of the same name", () => {
    const taken = new Set([`marc@vito.${DRIVER_LOGIN_DOMAIN}`]);
    expect(generateDriverLogin("Marc", "Vito", (e) => taken.has(e))).toBe(`marc-2@vito.${DRIVER_LOGIN_DOMAIN}`);
  });

  it("always yields something rather than failing to add the driver", () => {
    const login = generateDriverLogin("", "", () => true);
    expect(login).toContain(`@fleet.${DRIVER_LOGIN_DOMAIN}`);
    expect(login.startsWith("driver-")).toBe(true);
  });

  /** It is a name to sign in with, never somewhere to write. */
  it("is recognisable as not a mailbox", () => {
    expect(isGeneratedLogin(`marc@vito.${DRIVER_LOGIN_DOMAIN}`)).toBe(true);
    expect(isGeneratedLogin("marc@example.com")).toBe(false);
    expect(isGeneratedLogin(null)).toBe(false);
  });
});

describe("everything written to a driver goes through it", () => {
  it("the job sheet, the flight alert and the assignment email", () => {
    const partner = rd("lib/partner.ts");
    expect(partner).toContain("to: driverMailTo(driver)");
    expect(partner).toContain("driverEmail: driverMailTo(driver)");
    expect(rd("lib/flights/sweep.ts")).toContain("to:               driverMailTo(b.driver!)");
    expect(rd("app/api/bookings/[id]/route.ts")).toContain("const driverEmail = driverMailTo(booking.driver)");
  });

  /**
   * The password is the one message that must not go to the login address
   * when that address is generated: nobody would ever open it.
   */
  it("the temporary password, addressed to whoever reads the post", () => {
    const partner = rd("lib/partner.ts");
    expect(partner).toContain("to: notifyEmail ?? email");
    expect(partner).toContain("signInAs: notifyEmail ? email : undefined");
    // And the card prints the login, not the address it was delivered to.
    expect(rd("lib/resend.ts")).toContain("email: signInAs ?? to");
  });

  it("the queries that feed them ask for the field", () => {
    expect(rd("lib/flights/sweep.ts")).toContain("notifyEmail: true");
    expect(rd("app/api/partner/drivers/route.ts")).toContain("notifyEmail: true");
  });
});

describe("adding a fleet driver", () => {
  const lib = rd("lib/partner.ts");
  const api = rd("app/api/partner/drivers/route.ts");

  it("no longer demands an email", () => {
    expect(api).toContain('email:         z.string().email().or(z.literal("")).optional()');
    expect(lib).toContain("name: string; email?: string;");
  });

  it("makes a login and points the post at the company when none is given", () => {
    expect(lib).toContain("email = generateDriverLogin(input.name, partner.name");
    expect(lib).toContain("notifyEmail = partner.email.trim().toLowerCase()");
  });

  /**
   * The old message was a dead end: the company was told the address was
   * taken and not what to do instead, which is why one was asked for at all.
   */
  it("tells a company what to do when the address is already a login", () => {
    expect(lib).toContain("Leave the email empty and we will send this driver's mail to your company address instead.");
  });

  it("can be switched on or off for an existing driver", () => {
    const patch = rd("app/api/partner/drivers/[id]/route.ts");
    expect(patch).toContain("mailToCompany: z.boolean().optional()");
    expect(patch).toContain("notifyEmail: mailToCompany ? p.email.trim().toLowerCase() : null");
    // Leaving it out of the request must not silently clear it.
    expect(patch).toContain("mailToCompany === undefined ? {} :");
  });

  it("is offered in the panel, saying where the mail will land", () => {
    const page = rd("app/partner/(panel)/drivers/page.tsx");
    expect(page).toContain("Send this driver&apos;s mail to us");
    expect(page).toContain("companyEmail");
    // And the roster says so, so nobody wonders why a driver never writes back.
    expect(page).toContain("Mail goes to {d.notifyEmail}");
  });
});
