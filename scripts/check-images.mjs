/**
 * Build-time assertion: eqe-300.png must NOT be a copy of e-class.png.
 * Runs as `prebuild` — fails fast before `next build` if images are identical.
 *
 * Set SKIP_IMAGE_CHECK=1 to bypass (CI or staging builds without the real photo).
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

if (process.env.SKIP_IMAGE_CHECK === "1") {
  console.warn("⚠️   Image check SKIPPED (SKIP_IMAGE_CHECK=1). Replace eqe-300.png before production deploy.");
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public", "fleet");

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

const eclass = sha256(join(publicDir, "e-class.png"));
const eqe    = sha256(join(publicDir, "eqe-300.png"));

if (eclass === eqe) {
  console.error(
    "\n❌  BUILD BLOCKED: public/fleet/eqe-300.png is byte-identical to e-class.png.\n" +
    "    Replace eqe-300.png with the actual Mercedes EQE 300 Electric photo before deploying.\n" +
    "    To skip this check temporarily: SKIP_IMAGE_CHECK=1 npm run build\n"
  );
  process.exit(1);
}

console.log("✅  Image check passed: eqe-300.png is distinct from e-class.png.");
