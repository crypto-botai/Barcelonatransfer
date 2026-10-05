import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { findSecretProblems, ALLOWED_ENV_FILES } from "../../scripts/check-secrets.mjs";

/**
 * Nothing secret may be tracked by Git. The scanner reports where, never what.
 */

const scan = (path: string, content: string) => findSecretProblems([{ path, content }]) as { path: string; problem: string }[];

describe("environment files", () => {
  it("flags a tracked .env.production and any other tracked env file", () => {
    for (const name of [".env.production", ".env", ".env.local", ".env.vercel-live", "apps/x/.env.production"]) {
      expect(scan(name, "A=1")).toEqual([{ path: name, problem: "environment file is tracked" }]);
    }
  });

  it("allows only the documented examples", () => {
    expect([...ALLOWED_ENV_FILES].sort()).toEqual([".env.example", ".env.staging.example"]);
    expect(scan(".env.example", ["DATABASE_URL=", "postgresql://postgres:hunter2hunter2", "@db.example.com:5432/x"].join(""))).toEqual([]);
  });
});

describe("credential-shaped strings", () => {
  // Built from pieces at run time, so this file never holds a literal that looks like a
  // real credential (GitHub's push protection would, rightly, refuse it).
  const j = (...parts: string[]) => parts.join("");
  const bad: [string, string][] = [
    ["database URL with a password", j("const u = 'post", "gresql://app_owner:Zq81xKp3Vd7mWr2n", "@ep-cool-name-123456.eu-central-1.aws.neon.tech/db'")],
    ["signed token (JWT)", j("t = 'ey", "JhbGciOiJSUzI1NiJ9abcdefghijklmnopqrstuvwxyz1234.ey", "JzdWIiOiJvd25lcjpub21pIiwiaWF0IjoxfQabcdef.sig'")],
    ["SumUp secret key", j("key = 'sup_", "sk_AbCdEfGhIjKlMnOpQrStUv12'")],
    ["Meta access token", j("token = 'E", "AA", "A1b2C3d4E5".repeat(7), "'")],
    ["Twilio account SID", j("sid = 'A", "C0123456789abcdef0123456789abcdef'")],
    ["Resend key", j("k = 'r", "e_AbCdEfGhIjKlMnOpQrStUvWxYz'")],
    ["GitHub token", j("gh = 'gh", "p_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'")],
    ["private key block", j("-----BEGIN", " PRIVATE KEY-----", " MIIE")],
  ];

  for (const [label, content] of bad) {
    it(`finds a ${label}, and the report does not repeat it`, () => {
      const found = scan("lib/x.ts", content);
      expect(found).toEqual([{ path: "lib/x.ts", problem: label }]);
      expect(JSON.stringify(found)).not.toContain(content.slice(20, 40));
    });
  }

  it("ignores placeholders and ordinary code", () => {
    const ok = [
      "DATABASE_URL='postgresql://postgres:PASSWORD@db.example.com:5432/postgres'",
      "DATABASE_URL='postgresql://postgres.XXXX:XXXX@aws.pooler.supabase.com/postgres'",
      "SUMUP_API_KEY='sup_sk_your_key_here'",
      "const re = /^re_[a-z]+$/",
      "fetch('https://api.example.com/v1/items')",
    ];
    for (const c of ok) expect(scan("lib/x.ts", c)).toEqual([]);
  });

  it("does not scan tests, so a test may hold a fake secret", () => {
    expect(scan("lib/__tests__/x.test.ts", ["key = 'sup_", "sk_AbCdEfGhIjKlMnOpQrStUv12'"].join(""))).toEqual([]);
  });
});

describe("this repository", () => {
  it("tracks no environment file except the examples", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const envFiles = tracked.filter((f) => /(^|\/)\.env(\..+)?$/.test(f));
    expect(envFiles.filter((f) => !ALLOWED_ENV_FILES.has(f))).toEqual([]);
  });

  it("keeps the production env files ignored", () => {
    const ignored = execFileSync("git", ["check-ignore", ".env.production", ".env.vercel-live"], { encoding: "utf8" });
    expect(ignored).toContain(".env.production");
  });
});
