import { describe, it, expect } from "vitest";
import { ApiError } from "@/lib/api/v1/errors";
import {
  FAILURE_LIMIT, GENERIC_FAILURE, appForRole, assertMayUseApp, checkCredentials, normaliseEmail,
  type SignInDeps, type SignInUser,
} from "@/lib/api/v1/sign-in";

const customer: SignInUser = { id: "u1", email: "ana@example.com", name: "Ana", phone: null, role: "CUSTOMER", passwordHash: "HASH-ana", mustChangePassword: false, driverStatus: null };
const driver = (status: string | null): SignInUser => ({ ...customer, id: "d1", email: "omar@example.com", role: "DRIVER", passwordHash: "HASH-omar", driverStatus: status });

function deps(users: SignInUser[], failures = 0) {
  const calls = { compared: [] as string[], recorded: [] as string[] };
  const d: SignInDeps = {
    findUserByEmail: async (e) => users.find((u) => u.email === e) ?? null,
    recentFailures: async () => failures,
    recordFailure: async (key) => { calls.recorded.push(key); },
    // The "password" is right when the hash is HASH-<the password>.
    comparePassword: async (plain, hash) => { calls.compared.push(hash); return hash === `HASH-${plain}`; },
    dummyHash: async () => "DUMMY",
  };
  return { d, calls };
}

const thrown = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ApiError; } throw new Error("did not throw"); };
const input = (o: Partial<{ email: string; password: string; app: "customer" | "driver" }> = {}) => ({ email: "ana@example.com", password: "ana", app: "customer" as const, ip: "1.2.3.4", ...o });

describe("mobile sign-in rules", () => {
  it("accepts the right password and normalises the email", async () => {
    const { d } = deps([customer]);
    const r = await checkCredentials(d, input({ email: "  ANA@Example.com " }));
    expect(r.user.id).toBe("u1");
    expect(r.role).toBe("CUSTOMER");
    expect(normaliseEmail(" A@B.C ")).toBe("a@b.c");
  });

  it("gives one answer for a wrong password and for an account that does not exist", async () => {
    const wrong = await thrown(checkCredentials(deps([customer]).d, input({ password: "nope" })));
    const missing = await thrown(checkCredentials(deps([]).d, input({ email: "ghost@example.com" })));
    expect(wrong.code).toBe("UNAUTHENTICATED");
    expect(missing.code).toBe("UNAUTHENTICATED");
    expect(wrong.message).toBe(GENERIC_FAILURE);
    expect(missing.message).toBe(GENERIC_FAILURE);
  });

  it("still does the password work when the account does not exist, so timing does not reveal it", async () => {
    const { d, calls } = deps([]);
    await thrown(checkCredentials(d, input({ email: "ghost@example.com" })));
    expect(calls.compared).toEqual(["DUMMY"]);
  });

  it("an account with no password (a Google sign-up) cannot sign in with one", async () => {
    const { d } = deps([{ ...customer, passwordHash: null }]);
    expect((await thrown(checkCredentials(d, input()))).code).toBe("UNAUTHENTICATED");
  });

  it("records every failure and refuses after too many, whatever the password", async () => {
    const a = deps([customer]);
    await thrown(checkCredentials(a.d, input({ password: "nope" })));
    expect(a.calls.recorded).toEqual(["ana@example.com"]);

    const locked = deps([customer], FAILURE_LIMIT);
    const e = await thrown(checkCredentials(locked.d, input()));
    expect(e.code).toBe("RATE_LIMITED");
    expect(locked.calls.compared).toEqual([]); // the password is not even checked
  });
});

describe("which app an account may use", () => {
  it("the customer app takes customers only, the driver app drivers only", () => {
    expect(assertMayUseApp(customer, "customer")).toBe("CUSTOMER");
    expect(assertMayUseApp(driver("APPROVED"), "driver")).toBe("DRIVER");
    expect(() => assertMayUseApp(driver("APPROVED"), "customer")).toThrow(/not a customer account/);
    expect(() => assertMayUseApp(customer, "driver")).toThrow(/not a driver account/);
  });

  it("staff and partner roles get no mobile session", () => {
    for (const role of ["ADMIN", "PARTNER", "DISPATCHER", "SUPER_ADMIN"]) {
      expect(() => assertMayUseApp({ role, driverStatus: null }, "customer")).toThrow();
      expect(() => assertMayUseApp({ role, driverStatus: null }, "driver")).toThrow();
      expect(appForRole(role)).toBeNull();
    }
    expect(appForRole("CUSTOMER")).toBe("customer");
    expect(appForRole("DRIVER")).toBe("driver");
  });

  it("a driver must be approved, and says why when not", () => {
    for (const status of ["APPROVED", "ONLINE", "OFFLINE", "ON_RIDE"]) expect(assertMayUseApp(driver(status), "driver")).toBe("DRIVER");
    expect(() => assertMayUseApp(driver("PENDING_APPROVAL"), "driver")).toThrow(/waiting for approval/);
    expect(() => assertMayUseApp(driver("SUSPENDED"), "driver")).toThrow(/suspended/);
    expect(() => assertMayUseApp(driver(null), "driver")).toThrow(/not set up/);
  });

  it("a wrong-app message only appears after the password was right", async () => {
    // A driver trying the customer app with the WRONG password learns nothing about the account.
    const { d } = deps([driver("APPROVED")]);
    const e = await thrown(checkCredentials(d, { email: "omar@example.com", password: "wrong", app: "customer", ip: "x" }));
    expect(e.message).toBe(GENERIC_FAILURE);
  });
});
