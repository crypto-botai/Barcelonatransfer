import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { navUrl, freeWaitMinutes } from "@/lib/nav-links";
import { NOTIFICATION_EVENTS, EVENT_DEFS } from "@/lib/notifications/events";

/**
 * The on-the-road tools: navigation from the driver's stage buttons, the
 * waiting clock, the chat on a journey, and who may watch a live ride.
 */
const ROOT = process.cwd();
const rd = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("navigation links", () => {
  it("prefer coordinates and fall back to the typed address", () => {
    expect(navUrl("google", "Terminal 1", 41.29, 2.08)).toContain("destination=41.29,2.08");
    expect(navUrl("google", "Hotel Arts, Barcelona")).toContain(encodeURIComponent("Hotel Arts, Barcelona"));
    expect(navUrl("waze", "x", 41.29, 2.08)).toContain("ll=41.29,2.08");
    expect(navUrl("waze", "Hotel Arts")).toContain("navigate=yes");
  });
  it("treat 0,0 as no coordinates", () => {
    expect(navUrl("google", "Somewhere", 0, 0)).toContain("Somewhere");
  });
  it("include an hour at the airport and a quarter hour elsewhere", () => {
    expect(freeWaitMinutes(true)).toBe(60);
    expect(freeWaitMinutes(false)).toBe(15);
  });
});

describe("driver ride flow", () => {
  const panel = rd("components/driver/ActiveRidePanel.tsx");
  const stage = rd("components/driver/RideStageControl.tsx");
  it("opens navigation on start and on boarding, inside the tap", () => {
    expect(panel).toMatch(/s === "ON_THE_WAY" \? pickupNav : s === "ON_BOARD" \? dropoffNav/);
    // window.open must precede the fetch so the browser treats it as user-initiated.
    expect(stage.indexOf("window.open(nav")).toBeLessThan(stage.indexOf('fetch("/api/driver/ride"'));
  });
  it("has a copy button and a maps button beside each address", () => {
    expect(panel).toContain('aria-label={`Copy ${label} address`}');
    expect(panel).toContain('aria-label={`Navigate to ${label}`}');
    expect(panel).toContain("navigator.clipboard.writeText");
  });
  it("runs a waiting clock from arrival and tells the driver their earnings on completion", () => {
    expect(panel).toContain("function WaitTimer(");
    expect(panel).toMatch(/added to your earnings/);
    expect(rd("lib/ride-stages.ts")).toContain('action: "Start trip"');
  });
  it("settles cash and card on completion but not a pending transfer", () => {
    const ride = rd("app/api/driver/ride/route.ts");
    expect(ride).toContain('booking.paymentMethod === "CASH"');
    expect(ride).not.toMatch(/rideEndedAt: now, paymentStatus: "PAID" as const \}/);
  });
});

describe("trip chat", () => {
  const chat = rd("lib/trip-chat.ts");
  it("identifies each side by its own relation to the booking", () => {
    expect(chat).toContain("d.id === booking.driverId");
    expect(chat).toContain("p.id === booking.partnerId");
    expect(chat).toContain("code === booking.confirmationCode");
    expect(chat).toContain('u?.role === "ADMIN"');
  });
  it("notifies the customer of a message from anyone else", () => {
    expect(chat).toMatch(/if \(p\.sender !== "CUSTOMER"\)/);
    expect(NOTIFICATION_EVENTS).toContain("TRIP_MESSAGE");
    expect(EVENT_DEFS.TRIP_MESSAGE.copy.en.title).toContain("{{from}}");
  });
  it("is on every surface: driver, company, customer, public link, admin", () => {
    for (const p of [
      "components/driver/ActiveRidePanel.tsx",
      "components/partner/JobTools.tsx",
      "app/dashboard/tracking/[id]/page.tsx",
      "components/tracking/PublicTrackClient.tsx",
      "app/admin/bookings/page.tsx",
    ]) expect(rd(p), p).toContain("<TripChat");
  });
  it("the public link proves itself with the confirmation code", () => {
    expect(rd("components/tracking/PublicTrackClient.tsx")).toMatch(/<TripChat bookingId=\{booking\.id\} code=\{booking\.code\}/);
  });
});

describe("live location", () => {
  it("lets the dispatching company, and only it, watch the ride", () => {
    const t = rd("app/api/tracking/route.ts");
    expect(t).toContain("p.id === booking.partnerId");
    expect(t).toContain("partnerOk");
  });
  it("the company panel has live location and no-show proof on a job", () => {
    const tools = rd("components/partner/JobTools.tsx");
    expect(tools).toContain("export function LiveLocationSheet");
    expect(tools).toContain("export function NoShowSheet");
    expect(rd("app/api/partner/jobs/route.ts")).toContain("noShow: { select: { images: true");
  });
  it("admins can open the tracking page the board links to", () => {
    expect(rd("middleware.ts")).toMatch(/role === "ADMIN" && !pathname\.startsWith\("\/dashboard\/tracking\/"\)/);
  });
});

describe("who sees whom", () => {
  it("the customer sees the chauffeur's name, phone, email and vehicle on both tracking views", () => {
    expect(rd("app/api/bookings/[id]/route.ts")).toMatch(/user: \{ select: \{ name: true, image: true, phone: true, email: true \} \}/);
    expect(rd("app/dashboard/tracking/[id]/page.tsx")).toContain("booking.driver.user.email");
    expect(rd("app/track/[code]/page.tsx")).toContain("driverEmail:");
    const pub = rd("components/tracking/PublicTrackClient.tsx");
    expect(pub).toContain("booking.driverEmail");
    expect(pub).toContain("booking.plate");
  });
  it("the driver sees the customer's name, phone and email", () => {
    expect(rd("app/driver/page.tsx")).toContain("guestEmail: true");
    expect(rd("components/driver/DriverDashboard.tsx")).toContain("b.guestEmail");
  });
  it("only the customer can write their position, and it is dropped when they stop", () => {
    const api = rd("app/api/bookings/[id]/customer-location/route.ts");
    expect(api).toMatch(/me\.sender !== "CUSTOMER"\) return NextResponse\.json\(\{ error: "Unauthorized" \}/);
    expect(api).toContain("customerLat: null, customerLng: null, customerLocatedAt: null");
    expect(rd("components/tracking/ShareMyLocation.tsx")).toContain('method: "DELETE"');
  });
  it("the driver sees where the passenger is and can navigate to them", () => {
    expect(rd("components/driver/ActiveRidePanel.tsx")).toContain("<PassengerLocation");
    expect(rd("components/driver/PassengerLocation.tsx")).toContain("Go to them");
  });
});
