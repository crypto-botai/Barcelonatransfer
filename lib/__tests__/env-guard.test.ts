import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  assessDatabaseSafety,
  assertSafeDatabase,
  databaseHostFingerprints,
  resolveAppEnvironment,
  EnvGuardError,
  PRODUCTION_DB_HOST_FINGERPRINTS,
} from "@/lib/env-guard";

/**
 * Staging, previews, laptops and test runs must not be able to start against the
 * production database. These tests use a made-up "production" host, supplied
 * through PRODUCTION_DB_HOST_SHA256, so no real host name is in the repository.
 */

const sha = (host: string) => createHash("sha256").update(host).digest("hex");
const FAKE_PROD_HOST = "ep-fake-production-123456.eu-central-1.aws.neon.tech";
const FAKE_STAGING_HOST = "ep-fake-staging-654321.eu-central-1.aws.neon.tech";
const withProd = { PRODUCTION_DB_HOST_SHA256: sha(FAKE_PROD_HOST) };
const url = (host: string, pooled = false) => `postgresql://user:pw@${pooled ? host.replace(".", "-pooler.") : host}/db?sslmode=require`;

describe("which environment this is", () => {
  it("lets APP_ENV decide", () => {
    expect(resolveAppEnvironment({ APP_ENV: "staging", VERCEL_ENV: "production" })).toBe("staging");
    expect(resolveAppEnvironment({ APP_ENV: "production" })).toBe("production");
    expect(resolveAppEnvironment({ APP_ENV: " Staging " })).toBe("staging");
  });

  it("falls back to Vercel's own variable", () => {
    expect(resolveAppEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    expect(resolveAppEnvironment({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(resolveAppEnvironment({ VERCEL_ENV: "development" })).toBe("development");
  });

  it("treats a project whose own address says staging as staging, even if APP_ENV was forgotten", () => {
    expect(resolveAppEnvironment({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "elitebcn-staging.vercel.app" })).toBe("staging");
  });

  it("does not mistake the production project for staging because of a branch or deployment name", () => {
    const env = {
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "www.elitebcn.info",
      VERCEL_GIT_COMMIT_REF: "staging",
      VERCEL_BRANCH_URL: "barcelonatransfer-git-staging-team.vercel.app",
      VERCEL_URL: "barcelonatransfer-abc123-staging.vercel.app",
    };
    expect(resolveAppEnvironment(env)).toBe("production");
  });

  it("is 'unknown' when nothing says, which counts as not production", () => {
    expect(resolveAppEnvironment({})).toBe("unknown");
    expect(resolveAppEnvironment({ NODE_ENV: "production" })).toBe("unknown");
    expect(resolveAppEnvironment({ NODE_ENV: "test" })).toBe("test");
  });
});

describe("finding database hosts", () => {
  it("reads every postgres URL and host variable, pooled or not", () => {
    const found = databaseHostFingerprints({
      POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST, true),
      POSTGRES_URL_NON_POOLING: url(FAKE_PROD_HOST),
      PGHOST: FAKE_PROD_HOST,
      UNRELATED: "https://example.com",
    });
    expect(new Set(found)).toEqual(new Set([sha(FAKE_PROD_HOST)]));
  });

  it("ignores values that are not database addresses", () => {
    expect(databaseHostFingerprints({ A: "postgres://not a url", B: "hello", C: "" })).toEqual([]);
  });
});

describe("the guard", () => {
  it("refuses staging on the production database", () => {
    const v = assessDatabaseSafety({ APP_ENV: "staging", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST), ...withProd });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/Refusing to start/);
  });

  it("refuses the pooled form of the production host too", () => {
    expect(assessDatabaseSafety({ APP_ENV: "staging", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST, true), ...withProd }).ok).toBe(false);
  });

  it("refuses when only one of several database variables points at production", () => {
    expect(
      assessDatabaseSafety({
        APP_ENV: "staging",
        POSTGRES_PRISMA_URL: url(FAKE_STAGING_HOST),
        POSTGRES_URL_NON_POOLING: url(FAKE_PROD_HOST),
        ...withProd,
      }).ok,
    ).toBe(false);
  });

  it("refuses previews, local runs, tests and unknown environments on production", () => {
    for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, { NODE_ENV: "test" }, {}, { APP_ENV: "development" }]) {
      expect(assessDatabaseSafety({ ...env, POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST), ...withProd }).ok).toBe(false);
    }
  });

  it("lets staging start on its own database", () => {
    expect(assessDatabaseSafety({ APP_ENV: "staging", POSTGRES_PRISMA_URL: url(FAKE_STAGING_HOST), ...withProd }).ok).toBe(true);
  });

  it("lets production use the production database and checks nothing there", () => {
    expect(assessDatabaseSafety({ VERCEL_ENV: "production", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST), ...withProd }).ok).toBe(true);
    expect(assessDatabaseSafety({ APP_ENV: "production", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST), ...withProd }).ok).toBe(true);
    expect(assessDatabaseSafety({ VERCEL_ENV: "production", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST) }).ok).toBe(true);
  });

  it("lets an environment with no database at all start", () => {
    expect(assessDatabaseSafety({ APP_ENV: "staging" }).ok).toBe(true);
  });

  it("throws a named error that carries no host and no credentials", () => {
    const env = { APP_ENV: "staging", POSTGRES_PRISMA_URL: url(FAKE_PROD_HOST), ...withProd };
    expect(() => assertSafeDatabase(env)).toThrow(EnvGuardError);
    try {
      assertSafeDatabase(env);
    } catch (e) {
      const message = (e as Error).message;
      expect(message).not.toContain(FAKE_PROD_HOST);
      expect(message).not.toContain("pw@");
      expect(message).not.toContain("sslmode");
    }
  });

  it("holds a real production fingerprint, in the right shape", () => {
    expect(PRODUCTION_DB_HOST_FINGERPRINTS.length).toBeGreaterThan(0);
    for (const f of PRODUCTION_DB_HOST_FINGERPRINTS) expect(f).toMatch(/^[a-f0-9]{64}$/);
  });
});
