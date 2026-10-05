/**
 * Fails when something secret is committed.
 *
 *   node scripts/check-secrets.mjs
 *
 * Two checks over the files Git tracks:
 *   1. No environment file other than the documented examples is tracked. A tracked
 *      environment export is a common way for live settings to reach a public repository.
 *   2. No tracked file contains a string shaped like a real credential: a database
 *      URL with a password, a signed token, a provider key, a private key.
 *
 * It prints file paths and the kind of match, never the matching text, so its own
 * output cannot leak what it finds. It runs in CI on every pull request.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const ALLOWED_ENV_FILES = new Set([".env.example", ".env.staging.example"]);

/** [name, pattern]. Patterns avoid placeholders such as "your_key_here" and "XXXX". */
export const SECRET_PATTERNS = [
  ["database URL with a password", /postgres(?:ql)?:\/\/[^\s"'@/:]+:(?!PASSWORD|password|XXXX|\*+|\[)[^\s"'@/]{6,}@/],
  ["signed token (JWT)", /eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{20,}\./],
  ["SumUp secret key", /sup_sk_[A-Za-z0-9]{20,}/],
  ["Meta access token", /EAA[A-Za-z0-9]{60,}/],
  ["Twilio account SID", /\bAC[a-f0-9]{32}\b/],
  ["Resend key", /\bre_[A-Za-z0-9]{24,}\b/],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["Google OAuth secret", /GOCSPX-[A-Za-z0-9_-]{10,}/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const SKIP_PATH = /(^|\/)(node_modules|\.next|public\/blog|__tests__)\/|\.(png|jpe?g|webp|avif|gif|ico|woff2?|pdf|mp4|lock)$|package-lock\.json$/;

/** Pure, for tests. files: [{ path, content }]. Returns [{ path, problem }]. */
export function findSecretProblems(files) {
  const problems = [];
  for (const { path, content } of files) {
    const name = path.split("/").pop() ?? path;
    if (/^\.env(\..+)?$/.test(name) && !ALLOWED_ENV_FILES.has(path)) {
      problems.push({ path, problem: "environment file is tracked" });
      continue;
    }
    if (SKIP_PATH.test(path) || ALLOWED_ENV_FILES.has(path)) continue;
    for (const [label, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) problems.push({ path, problem: label });
    }
  }
  return problems;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
}

function main() {
  const files = [];
  for (const path of trackedFiles()) {
    if (SKIP_PATH.test(path) && !/^\.env/.test(path.split("/").pop() ?? "")) continue;
    let content = "";
    try {
      const buf = readFileSync(path);
      if (buf.length > 2_000_000 || buf.includes(0)) continue; // large or binary
      content = buf.toString("utf8");
    } catch {
      continue; // deleted in the working tree
    }
    files.push({ path, content });
  }
  const problems = findSecretProblems(files);
  if (problems.length === 0) {
    console.log(`check-secrets: ${files.length} tracked files scanned, nothing found.`);
    return;
  }
  console.error("check-secrets: possible secrets are tracked by Git:");
  for (const p of problems) console.error(`  ${p.path}: ${p.problem}`);
  console.error("Remove the file from Git, rotate anything that was real, and keep it out with .gitignore.");
  process.exit(1);
}

if ((process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/check-secrets.mjs")) main();
