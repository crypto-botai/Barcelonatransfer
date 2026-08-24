import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { driverAvailabilityLabel, isAssignableDriver } from "@/lib/driver-roster";

/**
 * The admin booking drawer listed only drivers whose status was "APPROVED".
 * A driver holds that status only until the first time they tap "Go Online",
 * after which they are ONLINE, OFFLINE or ON_RIDE and never APPROVED again —
 * so a roster of eight real drivers offered exactly one, the only one who had
 * never logged in, and no booking could be assigned to anybody else.
 */
describe("who can be assigned a booking", () => {
  it("includes every driver who is on the books", () => {
    for (const status of ["APPROVED", "ONLINE", "OFFLINE", "ON_RIDE"]) {
      expect(isAssignableDriver(status), status).toBe(true);
    }
  });

  it("excludes drivers who are unvetted or barred", () => {
    expect(isAssignableDriver("PENDING_APPROVAL")).toBe(false);
    expect(isAssignableDriver("SUSPENDED")).toBe(false);
  });

  it("treats a missing status as not assignable", () => {
    expect(isAssignableDriver(null)).toBe(false);
    expect(isAssignableDriver(undefined)).toBe(false);
    expect(isAssignableDriver("")).toBe(false);
  });

  it("keeps a driver assignable once they go online", () => {
    // The exact transition that emptied the list: a driver is created
    // APPROVED, then goes ONLINE and must stay assignable.
    expect(isAssignableDriver("APPROVED")).toBe(true);
    expect(isAssignableDriver("ONLINE")).toBe(true);
  });

  it("keeps an off-duty or mid-ride driver assignable", () => {
    // An admin scheduling next week does not care that the driver is off duty
    // now, and hiding them makes the booking unassignable.
    expect(isAssignableDriver("OFFLINE")).toBe(true);
    expect(isAssignableDriver("ON_RIDE")).toBe(true);
  });

  it("labels availability so the admin can still see who is busy", () => {
    expect(driverAvailabilityLabel("ONLINE")).toBe("on duty");
    expect(driverAvailabilityLabel("OFFLINE")).toBe("off duty");
    expect(driverAvailabilityLabel("ON_RIDE")).toBe("on a ride");
    expect(driverAvailabilityLabel("APPROVED")).toBe("not yet online");
  });
});

describe("no assignment surface re-implements the rule", () => {
  const FILES = [
    join("app", "admin", "bookings", "page.tsx"),
    join("components", "admin", "DispatchBoard.tsx"),
  ];

  it("filters the driver list through isAssignableDriver", () => {
    for (const rel of FILES) {
      const src = readFileSync(join(process.cwd(), rel), "utf-8");
      expect(src, `${rel} should use the shared rule`).toContain("isAssignableDriver");
    }
  });

  it("does not compare a driver status to APPROVED by hand", () => {
    // Both surfaces previously did their own status test and both were wrong.
    // Comments are stripped first: the fix left a note quoting the old check,
    // and matching prose would fail on the very comment explaining the bug.
    for (const rel of FILES) {
      const code = readFileSync(join(process.cwd(), rel), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      const handRolled = /status\s*===\s*["']APPROVED["']/.test(code);
      expect(handRolled, `${rel} hand-rolls the assignable check`).toBe(false);
    }
  });
});
