/**
 * Search Engine Submission Script
 * Submits all site URLs to: Google sitemap ping, Bing sitemap ping.
 *
 * IndexNow is NOT enabled — it requires a real verified key.
 * Set one up at https://www.indexnow.org/ and re-add then.
 *
 * Usage: node scripts/submit-all-engines.mjs
 */

const BASE    = "https://www.elitebcn.info";
const SITEMAP = `${BASE}/sitemap.xml`;

console.log(`\n🚀 Elite BCN — Search Engine Submission`);
console.log(`   Site: ${BASE}\n`);

// ── Helper ────────────────────────────────────────────────────────────────────
async function ping(label, url) {
  try {
    const res = await fetch(url, { method: "GET" });
    const status = res.status;
    const ok = status >= 200 && status < 300;
    console.log(`  ${ok ? "✓" : "✗"} ${label}: HTTP ${status}`);
    return ok;
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message}`);
    return false;
  }
}

// ── 1. Bing Webmaster — sitemap ping ─────────────────────────────────────────
async function submitBingSitemap() {
  console.log("━━ Bing Webmaster — sitemap ping ━━");
  await ping(
    "Bing sitemap ping",
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`
  );
}

// ── 2. Google — sitemap ping (deprecated but still works) ────────────────────
async function submitGoogleSitemap() {
  console.log("\n━━ Google — sitemap ping ━━");
  await ping(
    "Google sitemap ping",
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`
  );
}

// ── 3. Print summary of manual steps needed ───────────────────────────────────
function printManualSteps() {
  console.log(`
━━ Manual steps (one-time, if not done yet) ━━

  Google Search Console  → https://search.google.com/search-console
    • Verify ownership (DNS TXT or HTML file)
    • Sitemaps → Add → ${SITEMAP}
    • Request indexing for top priority URLs via URL Inspection

  Bing Webmaster Tools   → https://www.bing.com/webmasters
    • Verify ownership
    • Sitemaps → Submit → ${SITEMAP}
    • Connect your GSC account (auto-imports Google data)

  DuckDuckGo / Yahoo / Ecosia / Startpage
    • These use Bing or Google indexes — covered by steps above.
    • No separate submission needed.
`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  await submitBingSitemap();
  await submitGoogleSitemap();
  printManualSteps();
  console.log("Done.\n");
})();
