// Run with: node scripts/audit-extra-claims.mjs
// Find every place the site promises a paid extra as included or free.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP = /node_modules|\.next|\.git|__tests__|package-lock/;

/** The paid extras, and the words each is written with on the site. */
const PAID = [
  { id: "meet_greet",    words: ["meet & greet", "meet and greet", "meet-and-greet", "meets you at arrivals", "inside arrivals", "in the arrivals hall"] },
  { id: "name_board",    words: ["name board", "name sign", "name on the driver", "name on a tablet", "your name on"] },
  { id: "baby_seat",     words: ["baby seat", "child seat", "booster seat", "child restraint"] },
  { id: "pet_transport", words: ["pet transport", "bring my pet", "travel with your pet", "pets are welcome"] },
  { id: "multi_stop",    words: ["multiple stops", "extra stop", "additional stop"] },
  { id: "extra_waiting", words: ["extra waiting", "additional waiting"] },
];

/** Words that turn a mention into a promise. */
const CLAIM = /\b(included|include|complimentary|free of charge|at no (extra )?(cost|charge)|no extra cost|free)\b/i;
/** Words that make it honest: it says there is a price. */
const PRICED = /(€\s?\d|\bEUR\s?\d|\bextra\b|\badd-?on\b|\boptional\b|\bpaid\b|\bcharge[ds]?\b|\bsupplement\b|on request|priceLabel|EXTRAS_CATALOG)/i;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?|json|md)$/.test(e)) files.push(p);
  }
})(ROOT);

const findings = [];
for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const low = line.toLowerCase();
    for (const extra of PAID) {
      if (!extra.words.some((w) => low.includes(w))) continue;
      if (!CLAIM.test(line)) continue;
      // A line that also states a price or calls it optional is fine.
      if (PRICED.test(line)) continue;
      findings.push({ file: rel, line: i + 1, id: extra.id, text: line.trim().slice(0, 155) });
    }
  });
}

/**
 * Lines that name a paid extra and the word "included" but are not claims.
 *
 * Kept as substrings rather than line numbers, so that editing a file above
 * one of them does not silently re-allow something else.
 */
const ALLOWED = [
  // Code comments describing the tier logic or this very bug.
  "so Gold's meet & greet is actually free rather than merely advertised",
  'This block used to state flatly that meet and greet was "included',
  'Gold\'s "free meet & greet" was decoration until now',
  // A question asking whether it is included. The answer beneath says the price.
  '"q": "Does the Hotel Arts Barcelona transfer include meet & greet service?"',
  // Genuinely included, for the tiers that waive it in WAIVED_EXTRAS.
  '"Meet & greet and name board included"',
];

const unexpected = findings.filter((f) => !ALLOWED.some((a) => f.text.includes(a)));

console.log(`scanned ${files.length} files`);
console.log(`${findings.length} matched, ${findings.length - unexpected.length} allowed, ${unexpected.length} unexpected\n`);

if (!unexpected.length) {
  console.log("No unqualified claim about a paid extra. Every mention either states a price, calls it optional, or is allow-listed.");
  process.exit(0);
}

console.log("These promise a paid extra without saying it costs anything:\n");
for (const f of unexpected) console.log(`${f.file}:${f.line}  [${f.id}]\n    ${f.text}\n`);
process.exit(1);
