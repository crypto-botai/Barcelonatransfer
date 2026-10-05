/**
 * Run before any command that writes to a database from a developer's machine:
 *
 *   npm run db:push:staging      (prisma db push, staging only)
 *   npm run db:seed:staging      (synthetic data, staging only)
 *
 * It stops the command unless the shell says it is staging AND no database
 * variable, including the ones Prisma will read from .env files, names the
 * production database. It prints nothing about hosts or credentials.
 *
 * `prisma db push` is how this project changes its schema, and it can drop
 * columns. Running it against production by accident is the failure this exists
 * to prevent, which is why the production variables are not accepted here at all.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assessDatabaseSafety, databaseHostFingerprints, resolveAppEnvironment } from "../../lib/env-guard";

/** Minimal .env reader: KEY=value lines, optional quotes. Existing shell values win, as in Prisma. */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

const root = process.cwd();
// Prisma loads prisma/.env then ./.env; the shell wins over both.
const fromFiles = { ...readEnvFile(join(root, ".env")), ...readEnvFile(join(root, "prisma", ".env")) };
const combined: Record<string, string | undefined> = { ...fromFiles, ...process.env };

const environment = resolveAppEnvironment(combined);
const verdict = assessDatabaseSafety(combined);

if (environment !== "staging") {
  console.error(`assert-staging: APP_ENV must be "staging" to run this (it is "${environment}"). Set APP_ENV=staging in this shell.`);
  process.exit(1);
}
if (!verdict.ok) {
  console.error(`assert-staging: ${verdict.reason}`);
  process.exit(1);
}
if (databaseHostFingerprints(combined).length === 0) {
  console.error("assert-staging: no database variable is set. Set POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING to the staging database.");
  process.exit(1);
}
console.log("assert-staging: staging environment, no production database named. Continuing.");
