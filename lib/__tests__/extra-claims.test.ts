import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { arrivalInstructions } from "@/lib/policies";

/**
 * The site may not promise a paid extra as included.
 *
 * It did, in eleven places, for months: the checkout said meet and greet was
 * "included ... at no extra cost" next to an order form charging EUR 5 for
 * it, the template behind forty-one destination pages said the chauffeur
 * waits in the arrivals hall with a name board, and all nine languages of
 * the airport service blurb promised a personal greeting. A customer who
 * believed any of those would stand in arrivals waiting for someone who is
 * outside by design.
 *
 * scripts/audit-extra-claims.mjs walks every file and exits non-zero on a
 * mention that neither states a price nor calls the thing optional. Running
 * it here means the next such sentence fails the build rather than reaching
 * an airport.
 */
const ROOT = join(__dirname, "..", "..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("no page promises a paid extra as included", () => {
  it("passes the site-wide claim audit", () => {
    let out = "";
    try {
      out = execFileSync("node", ["scripts/audit-extra-claims.mjs"], { cwd: ROOT, encoding: "utf-8" });
    } catch (e) {
      const err = e as { stdout?: string };
      throw new Error("Unqualified claim about a paid extra:\n" + (err.stdout ?? String(e)));
    }
    expect(out).toContain("0 unexpected");
  });

  it("the fixes that audit is guarding are still in place", () => {
    // The template behind the programmatic destination pages.
    const tpl = rd("app/transfers/[slug]/page.tsx");
    expect(tpl).not.toContain("Your driver waits in the BCN Airport arrivals hall with your name on a board");
    expect(tpl).toContain("is a €5 extra added when you book");
    // Every language of the airport blurb.
    for (const lang of ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ar"]) {
      const m = JSON.parse(rd(`messages/${lang}.json`)) as { services: { list: { airport: { desc: string } } } };
      const desc = m.services.list.airport.desc;
      expect(desc, lang).not.toMatch(/meet\s*&?\s*greet|recepción|accueil|begrüßung|accoglienza|receção|табличк|встреча|举牌|استقبال/i);
    }
  });
});

describe("the paid-booking email says where to meet the chauffeur", () => {
  it("tells an airport customer without meet and greet to go outside", () => {
    const r = arrivalInstructions({ airportPickup: true, meetGreet: false, nameBoard: false });
    expect(r.points.join(" ")).toContain("not inside the arrivals hall");
    expect(r.points.join(" ")).toContain("next to the taxi rank");
    // ...and offers the thing they did not buy, rather than implying they have it.
    expect(r.points.join(" ")).toContain("add meet and greet for 5 euros");
  });

  it("gives a meet and greet customer the protocol and the meeting points", () => {
    const r = arrivalInstructions({ airportPickup: true, meetGreet: true, nameBoard: false });
    const text = r.points.join(" ");
    expect(text).toContain("please come to the meeting point");
    expect(text).toContain("ten minutes");
    expect(text).toContain("Como restaurant");
    expect(text).toContain("Terminal 2A");
    expect(text).toContain("board with your name");
    expect(text).toContain("refund the meet and greet fee");
  });

  it("mentions a name board only when one was bought", () => {
    const without = arrivalInstructions({ airportPickup: true, meetGreet: false, nameBoard: false });
    expect(without.points.join(" ")).not.toContain("will be holding a board");
    const with_ = arrivalInstructions({ airportPickup: true, meetGreet: false, nameBoard: true });
    expect(with_.points.join(" ")).toContain("holding a board with your name");
  });

  it("does not give terminal directions for a city pickup", () => {
    const r = arrivalInstructions({ airportPickup: false, meetGreet: false, nameBoard: false });
    const text = r.points.join(" ");
    expect(text).not.toContain("Terminal");
    expect(text).not.toContain("arrivals hall");
    expect(text).toContain("calls you when they are outside");
  });

  it("reaches the emails a customer actually receives", () => {
    const prem = rd("lib/email/premium.ts");
    expect(prem).toContain("function arrivalPanel(");
    // The paid receipt and the booking-received email both render it.
    expect(prem.split("${arrivalPanel(o.arrival)}").length - 1).toBe(2);
    const resend = rd("lib/resend.ts");
    expect(resend).toContain("function arrivalFor(");
    expect(resend).toContain("arrival: arrivalFor(");
    // Which needs the booking's own coordinates and extras, from both senders.
    expect(rd("lib/payment-completion.ts")).toContain("specialRequests:  updated.specialRequests");
    expect(rd("app/api/admin/bookings/[id]/payment/route.ts")).toContain("specialRequests:  booking.specialRequests");
  });
});
