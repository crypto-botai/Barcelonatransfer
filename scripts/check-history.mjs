/**
 * Looks for secrets anywhere in Git HISTORY, not just in the files that are tracked now.
 *
 *   node scripts/check-history.mjs
 *
 * check-secrets.mjs only reads the current tree, so a credential that was committed and
 * later deleted passes it. This reads every file version reachable from any ref
 * and reports:
 *   1. any file that was ever tracked under a name that holds environment settings
 *      (.env, .env.production, ...) or looks like a throwaway script (tmp_*.js);
 *   2. any file version containing a credential-shaped string.
 *
 * It prints paths and the kind of match, how many versions, never the matching text.
 * Use it after a history rewrite to prove the rewrite worked: it must report nothing.
 * It is read-only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { SECRET_PATTERNS, ALLOWED_ENV_FILES } from "./check-secrets.mjs";

const MAX_BLOB = 2_000_000;

/** Names that must never have been tracked, whatever they contained. */
export function forbiddenPathProblem(path) {
  const name = path.split("/").pop() ?? path;
  if (/^\.env(\..+)?$/.test(name) && !ALLOWED_ENV_FILES.has(path)) return "environment file was tracked";
  if (/^tmp_.*\.(c|m)?js$/.test(name)) return "throwaway script was tracked";
  return null;
}

/** Pure, for tests. versions: [{ path, content }]. Returns [{ path, problem, versions }]. */
export function classifyHistory(versions) {
  const tally = new Map();
  const add = (path, problem) => {
    const key = `${path}\u0000${problem}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  };
  for (const { path, content } of versions) {
    const forbidden = forbiddenPathProblem(path);
    if (forbidden) add(path, forbidden);
    if (ALLOWED_ENV_FILES.has(path) || /(^|\/)(node_modules|__tests__)\//.test(path)) continue;
    for (const [label, pattern] of SECRET_PATTERNS) if (pattern.test(content)) add(path, label);
  }
  return [...tally].map(([key, versions]) => {
    const [path, problem] = key.split("\u0000");
    return { path, problem, versions };
  });
}

function git(cwd, args, input) {
  const r = spawnSync("git", args, { cwd, input, maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed`);
  return r.stdout;
}

/** Reads every blob reachable from any ref, with the path it had. */
export function readHistoryBlobs(cwd = process.cwd()) {
  const listing = execFileSync("git", ["rev-list", "--all", "--objects"], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const pathOf = new Map();
  for (const line of listing.split("\n")) {
    const space = line.indexOf(" ");
    if (space > 0) pathOf.set(line.slice(0, space), line.slice(space + 1));
  }
  const shas = [...pathOf.keys()];
  if (shas.length === 0) return [];

  const checks = git(cwd, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], shas.join("\n") + "\n")
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split(" "));
  const wanted = checks.filter(([, type, size]) => type === "blob" && Number(size) <= MAX_BLOB).map(([sha]) => sha);
  if (wanted.length === 0) return [];

  const raw = git(cwd, ["cat-file", "--batch"], wanted.join("\n") + "\n");
  const blobs = [];
  let offset = 0;
  while (offset < raw.length) {
    const eol = raw.indexOf(10, offset);
    if (eol === -1) break;
    const [sha, , sizeText] = raw.subarray(offset, eol).toString("utf8").split(" ");
    const size = Number(sizeText);
    const body = raw.subarray(eol + 1, eol + 1 + size);
    offset = eol + 1 + size + 1;
    if (body.includes(0)) continue; // binary
    blobs.push({ path: pathOf.get(sha) ?? "(unknown path)", content: body.toString("utf8") });
  }
  return blobs;
}

export function scanRepositoryHistory(cwd = process.cwd()) {
  return classifyHistory(readHistoryBlobs(cwd));
}

function main() {
  const problems = scanRepositoryHistory();
  if (problems.length === 0) {
    console.log("check-history: no environment files, throwaway scripts or credential-shaped strings in any reachable history.");
    return;
  }
  console.error("check-history: history still contains:");
  for (const p of problems.sort((a, b) => a.path.localeCompare(b.path))) console.error(`  ${p.path}: ${p.problem} (${p.versions} version${p.versions === 1 ? "" : "s"})`);
  console.error("Nothing is printed beyond paths and kinds. Rotate anything real that is listed.");
  process.exit(1);
}

if ((process.argv[1] ?? "").split("\\").join("/").endsWith("scripts/check-history.mjs")) main();
