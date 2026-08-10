import { describe, it, expect } from "vitest";
import { shouldForcePasswordChange } from "../auth-gates";

describe("shouldForcePasswordChange", () => {
  it("leaves accounts with a password of their own alone", () => {
    for (const p of ["/driver", "/dashboard", "/admin", "/"]) {
      expect(shouldForcePasswordChange(p, false)).toBe(false);
      expect(shouldForcePasswordChange(p, undefined)).toBe(false);
    }
  });

  it("diverts the portals a temporary password actually lands on", () => {
    // Signing in sends drivers to /driver and customers to /dashboard. If the
    // gate misses these, nobody is ever asked to choose their own password.
    for (const p of ["/driver", "/dashboard", "/admin", "/", "/booking"]) {
      expect(shouldForcePasswordChange(p, true)).toBe(true);
    }
  });

  it("never diverts an API call", () => {
    // A redirected POST reaches the target as a GET for an HTML page, so the
    // caller parses markup as JSON and reports a failure. /api/auth/change-password
    // is the only call that clears the flag: divert it and the account is
    // locked out permanently, with no error that names the cause.
    expect(shouldForcePasswordChange("/api/auth/change-password", true)).toBe(false);
    expect(shouldForcePasswordChange("/api/auth/session", true)).toBe(false);
    expect(shouldForcePasswordChange("/api/bookings", true)).toBe(false);
  });

  it("lets the change-password page and the way out through", () => {
    expect(shouldForcePasswordChange("/auth/change-password", true)).toBe(false);
    expect(shouldForcePasswordChange("/auth/logout", true)).toBe(false);
  });

  it("does not confuse the API route with the page route", () => {
    // The bug this guards against: matching "/auth/change-password" against
    // "/api/auth/change-password", which does not start with it.
    expect(shouldForcePasswordChange("/api/auth/change-password", true)).toBe(false);
    expect(shouldForcePasswordChange("/auth/change-password", true)).toBe(false);
  });
});
