import { describe, it, expect } from "vitest";
import { verifyGoogleIdToken, GOOGLE_MOBILE_CLIENT_ID, GOOGLE_IPHONE_WEB_CLIENT_ID } from "@/lib/api/v1/google-token";

const NOW = 1_800_000_000_000;
const good = { aud: GOOGLE_MOBILE_CLIENT_ID, iss: "https://accounts.google.com", exp: String(NOW / 1000 + 600), email: "Driver@Example.com", email_verified: "true", name: "Nouman", picture: "https://lh3.googleusercontent.com/a/x", sub: "123" };
const reply = (info: Record<string, unknown>, ok = true) => async () => ({ ok, json: async () => info });
const run = (info: Record<string, unknown>, ok = true) => verifyGoogleIdToken("t".repeat(200), { fetcher: reply(info, ok), nowMs: NOW });

describe("verifyGoogleIdToken", () => {
  it("accepts a token issued to our app and returns the lower-cased verified email", async () => {
    await expect(run(good)).resolves.toMatchObject({ email: "driver@example.com", name: "Nouman", subject: "123" });
  });

  it("accepts a token made for the iPhone apps' web client, and still refuses a look-alike client", async () => {
    await expect(run({ ...good, aud: GOOGLE_IPHONE_WEB_CLIENT_ID })).resolves.toMatchObject({ email: "driver@example.com" });
    await expect(run({ ...good, aud: "163147095821-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.apps.googleusercontent.com" })).rejects.toThrow();
  });

  it("rejects a token made for another app", async () => {
    await expect(run({ ...good, aud: "someone-else.apps.googleusercontent.com" })).rejects.toThrow();
  });

  it("rejects an expired token, a wrong issuer and an unverified email", async () => {
    await expect(run({ ...good, exp: String(NOW / 1000 - 5) })).rejects.toThrow();
    await expect(run({ ...good, iss: "https://evil.example" })).rejects.toThrow();
    await expect(run({ ...good, email_verified: "false" })).rejects.toThrow();
    await expect(run({ ...good, email: undefined })).rejects.toThrow();
  });

  it("rejects what Google itself refuses", async () => {
    await expect(run({ error: "invalid_token" }, false)).rejects.toThrow();
  });

  it("says the service is unavailable when Google cannot be reached", async () => {
    await expect(verifyGoogleIdToken("t".repeat(200), { fetcher: async () => { throw new Error("offline"); }, nowMs: NOW })).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});
