import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyHistory, forbiddenPathProblem, scanRepositoryHistory } from "../../scripts/check-history.mjs";

/**
 * The history scanner finds a credential that was committed and later deleted, the
 * case the tree scanner cannot see, and proves a history rewrite worked. It reports
 * paths and kinds, never the matching text.
 */

// Built from fragments so this file holds no literal that looks like a credential.
const j = (...parts: string[]) => parts.join("");
const FAKE_DB_URL = j("const u = 'post", "gresql://app_owner:Zq81xKp3Vd7mWr2n", "@ep-cool-name-123456.eu-central-1.aws.neon.tech/db'");
const FAKE_KEY = j("-----BEGIN", " PRIVATE KEY-----\n", "A".repeat(80), "\n-----END", " PRIVATE KEY-----");

describe("paths that must never have been tracked", () => {
  it("flags environment files and throwaway scripts, but not the documented examples", () => {
    expect(forbiddenPathProblem(".env.production")).toMatch(/environment file/);
    expect(forbiddenPathProblem("apps/x/.env")).toMatch(/environment file/);
    expect(forbiddenPathProblem("tmp_probe_one.js")).toMatch(/throwaway/);
    expect(forbiddenPathProblem("scripts/tmp_probe.mjs")).toMatch(/throwaway/);
    expect(forbiddenPathProblem(".env.example")).toBeNull();
    expect(forbiddenPathProblem(".env.staging.example")).toBeNull();
    expect(forbiddenPathProblem("lib/tmp-helper.ts")).toBeNull();
  });
});

describe("classifying file versions", () => {
  it("counts versions per path and kind, and ignores placeholders and tests", () => {
    const found = classifyHistory([
      { path: "scripts/a.mjs", content: FAKE_KEY },
      { path: "scripts/a.mjs", content: FAKE_KEY },
      { path: "scripts/a.mjs", content: "const key = process.env.KEY" },
      { path: ".env.example", content: FAKE_DB_URL },
      { path: "lib/__tests__/x.test.ts", content: FAKE_KEY },
      { path: "docs/readme.md", content: "DATABASE_URL=postgresql://postgres:PASSWORD@db.example.com/postgres" },
    ]);
    expect(found).toEqual([{ path: "scripts/a.mjs", problem: "private key block", versions: 2 }]);
  });

  it("never carries the matching text in its result", () => {
    const text = JSON.stringify(classifyHistory([{ path: "x.js", content: FAKE_DB_URL }]));
    expect(text).not.toContain("Zq81xKp3Vd7mWr2n");
    expect(text).not.toContain("ep-cool-name");
  });
});

describe("a real repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "elitebcn-history-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reports nothing for a clean history", () => {
    git("init", "-q", "-b", "main");
    writeFileSync(join(dir, "README.md"), "hello\n");
    git("add", "-A");
    git("commit", "-q", "-m", "clean");
    expect(scanRepositoryHistory(dir)).toEqual([]);
  });

  it("finds a secret that was committed and then deleted, and a tracked env file", () => {
    writeFileSync(join(dir, "tmp_probe.js"), FAKE_DB_URL + "\n");
    writeFileSync(join(dir, ".env.production"), "A=1\n");
    mkdirSync(join(dir, "scripts"));
    writeFileSync(join(dir, "scripts", "idx.mjs"), `const k = \`${FAKE_KEY}\`\n`);
    git("add", "-A");
    git("commit", "-q", "-m", "oops");
    git("rm", "-q", "tmp_probe.js", ".env.production");
    writeFileSync(join(dir, "scripts", "idx.mjs"), "const k = process.env.KEY\n");
    git("add", "-A");
    git("commit", "-q", "-m", "remove them");

    const problems = scanRepositoryHistory(dir) as { path: string; problem: string }[];
    const summary = problems.map((p) => `${p.path}|${p.problem}`).sort();
    expect(summary).toEqual([
      ".env.production|environment file was tracked",
      "scripts/idx.mjs|private key block",
      "tmp_probe.js|database URL with a password",
      "tmp_probe.js|throwaway script was tracked",
    ]);
  });

  it("does not repeat the secret anywhere in what it reports", () => {
    expect(JSON.stringify(scanRepositoryHistory(dir))).not.toContain("Zq81xKp3Vd7mWr2n");
  });
});
