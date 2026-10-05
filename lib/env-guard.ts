import { createHash } from "node:crypto";

/**
 * Keeps every environment that is not production away from the production
 * database.
 *
 * The site has one real database. A staging deployment, a preview, a developer's
 * laptop or a test run that is pointed at it by mistake can change real bookings
 * and real customers. Nothing in Vercel or Neon stops that, so the application
 * refuses to start instead.
 *
 * How it knows the production database without storing it: the host name is
 * compared by its SHA-256 fingerprint, so this file holds no connection detail.
 * Neon's pooled and direct hosts differ only by "-pooler", so that is removed
 * before comparing and both forms are recognised.
 *
 * How it knows which environment it is in: APP_ENV, when set, decides. Without
 * it, Vercel's VERCEL_ENV does. Production sets neither APP_ENV nor anything
 * unusual, so on production this guard checks nothing and changes nothing.
 * Every other case, including "no information at all", is treated as not
 * production, because that is the safe way to be wrong.
 *
 * There is deliberately no switch to turn this off. To work on production data
 * deliberately, use the Vercel production deployment or a script run on purpose
 * with the production variables, never a staging or local start.
 */

/** SHA-256 of the lower-cased production database host, without "-pooler". */
export const PRODUCTION_DB_HOST_FINGERPRINTS: readonly string[] = [
  "4c5abd33561db480d50fe8bbe09c5199e62e6d661ca668e742c09dccd706d742",
];

export type AppEnvironment = "production" | "staging" | "development" | "test" | "preview" | "unknown";

type Env = Record<string, string | undefined>;

const EXPLICIT: readonly AppEnvironment[] = ["production", "staging", "development", "test"];

/** Which environment this process is. Anything unclear is "unknown", which counts as not production. */
export function resolveAppEnvironment(env: Env = process.env): AppEnvironment {
  const explicit = (env.APP_ENV ?? "").trim().toLowerCase();
  if ((EXPLICIT as readonly string[]).includes(explicit)) return explicit as AppEnvironment;

  // A second Vercel project that only forgot APP_ENV still has "staging" in its own
  // project address. Only that project-level address is used: a branch name or a
  // per-deployment address can contain "staging" on the production project too (a
  // preview of the staging branch promoted to production), and misreading that
  // would stop production from starting.
  if ((env.VERCEL_PROJECT_PRODUCTION_URL ?? "").toLowerCase().includes("staging")) return "staging";

  const vercel = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  if (vercel === "development") return "development";

  if (env.NODE_ENV === "test") return "test";
  return "unknown";
}

const fingerprint = (host: string) =>
  createHash("sha256").update(host.trim().toLowerCase().replace(/-pooler(?=\.)/, "")).digest("hex");

/** Every database host named anywhere in the environment, as fingerprints. */
export function databaseHostFingerprints(env: Env = process.env): string[] {
  const found = new Set<string>();
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (/^postgres(ql)?:\/\//i.test(value)) {
      try {
        found.add(fingerprint(new URL(value).hostname));
      } catch { /* not a URL, nothing to compare */ }
    } else if (/^(PGHOST|PGHOST_UNPOOLED|POSTGRES_HOST|DATABASE_HOST)$/.test(key)) {
      found.add(fingerprint(value));
    }
  }
  return [...found];
}

export type DatabaseSafety =
  | { ok: true; environment: AppEnvironment }
  | { ok: false; environment: AppEnvironment; reason: string };

/** Pure check, so it can be tested. Never includes a host or a credential in what it returns. */
export function assessDatabaseSafety(env: Env = process.env): DatabaseSafety {
  const environment = resolveAppEnvironment(env);
  if (environment === "production") return { ok: true, environment };

  const extra = (env.PRODUCTION_DB_HOST_SHA256 ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const production = new Set([...PRODUCTION_DB_HOST_FINGERPRINTS, ...extra]);
  const hit = databaseHostFingerprints(env).find((f) => production.has(f));
  if (!hit) return { ok: true, environment };

  return {
    ok: false,
    environment,
    reason:
      `Refusing to start: the "${environment}" environment is configured with the production database ` +
      `(host fingerprint ${hit.slice(0, 8)}). Point its database variables at the staging database.`,
  };
}

export class EnvGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvGuardError";
  }
}

/** Throws when this process is not production but can reach the production database. */
export function assertSafeDatabase(env: Env = process.env): void {
  const verdict = assessDatabaseSafety(env);
  if (!verdict.ok) throw new EnvGuardError(verdict.reason);
}
