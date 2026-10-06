import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The one-time admin seed endpoint is gone, and no HTTP route can create or promote an
 * administrator. The seed route was open to anyone on the internet whenever its secret variable
 * was not set, and it was the only code in the application able to make an administrator.
 */

const ROOT = join(__dirname, "..", "..");

describe("the one-time admin seed endpoint is gone", () => {
  it("has no route file, and nothing in the repository refers to its path", () => {
    expect(existsSync(join(ROOT, "app", "api", "admin", "seed", "route.ts"))).toBe(false);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".next", ".git", "__tests__", "superpowers"].includes(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs|json|md|yml)$/.test(name) && /api\/admin\/seed/.test(readFileSync(p, "utf8"))) offenders.push(p.slice(ROOT.length + 1));
      }
    };
    for (const dir of ["app", "components", "lib", "scripts", "public"]) if (existsSync(join(ROOT, dir))) walk(join(ROOT, dir));
    expect(offenders).toEqual([]);
  });
});

describe("no HTTP route can create or promote an administrator", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) files.push(p);
    }
  };
  walk(join(ROOT, "app", "api"));

  it("no route under app/api writes the ADMIN role onto a user", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      // a user create / update / upsert whose data names the ADMIN role
      return /user\.(create|update|upsert|updateMany)\([\s\S]{0,400}?role\s*:\s*["']ADMIN["']/.test(src);
    });
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it("no route lets the caller choose a role in a user write", () => {
    const offenders = files.filter((f) => /user\.(create|update|upsert|updateMany)\([\s\S]{0,400}?role\s*:\s*(body|data|input|parsed|d)\b/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});
