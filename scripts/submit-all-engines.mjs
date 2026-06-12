/**
 * Search Engine Submission Script
 * Submits all site URLs to: IndexNow (Bing, Yandex, Seznam, Naver, Mojeek),
 * Google sitemap ping, and Bing sitemap ping.
 *
 * Usage: node scripts/submit-all-engines.mjs
 */

const BASE      = "https://www.elitebcn.info";
const SITEMAP   = `${BASE}/sitemap.xml`;
const INDEXNOW_KEY = "a1b2c3d4e5f6789012345678elitebcn";

// ── All site URLs ─────────────────────────────────────────────────────────────
const CORE_URLS = [
  BASE,
  `${BASE}/book`,
  `${BASE}/pricing`,
  `${BASE}/fleet`,
  `${BASE}/airport-transfers`,
  `${BASE}/corporate`,
  `${BASE}/hourly`,
  `${BASE}/faq`,
  `${BASE}/about`,
  `${BASE}/contact`,
  `${BASE}/privacy`,
  `${BASE}/terms`,
  `${BASE}/cookies`,
];

const TOOL_URLS = [
  `${BASE}/tools/transfer-cost-calculator`,
];

const STATIC_TRANSFER_URLS = [
  `${BASE}/transfers`,
  `${BASE}/transfers/sitges`,
  `${BASE}/transfers/girona`,
  `${BASE}/transfers/montserrat`,
  `${BASE}/transfers/costa-brava`,
  `${BASE}/transfers/tarragona`,
  `${BASE}/transfers/andorra`,
  `${BASE}/transfers/cruise-port`,
  `${BASE}/transfers/port-aventura`,
];

// 44 dynamic destination slugs
const DESTINATION_SLUGS = [
  // Hotels
  "w-barcelona-hotel", "hotel-arts-barcelona", "mandarin-oriental-barcelona",
  "hotel-el-palace-barcelona", "majestic-hotel-barcelona", "cotton-house-hotel-barcelona",
  "ohla-barcelona", "grand-hyatt-barcelona", "four-seasons-barcelona",
  "fairmont-rey-juan-carlos", "hilton-diagonal-mar", "sofia-hotel-barcelona",
  "almanac-barcelona", "the-serras-hotel", "hotel-1898-barcelona",
  "barcelo-raval", "hotel-condes-barcelona", "pullman-barcelona-skipper",
  "ayre-hotel-rosellon", "nobu-hotel-barcelona",
  // Cruise lines
  "msc-cruises-barcelona", "royal-caribbean-barcelona", "celebrity-cruises-barcelona",
  "norwegian-cruise-barcelona", "princess-cruises-barcelona", "costa-cruises-barcelona",
  "cunard-barcelona", "carnival-cruises-barcelona",
  // Events
  "mwc-2027-barcelona", "primavera-sound-2026", "f1-spanish-grand-prix",
  "sonar-festival-barcelona", "ise-2027-barcelona", "salon-nautico-barcelona",
  // Routes
  "valencia-transfer", "madrid-transfer", "perpignan-transfer", "lleida-transfer",
  "reus-airport", "girona-airport", "castelldefels-transfer", "salou-transfer",
  "mataro-transfer", "terrassa-transfer",
];

const DYNAMIC_URLS = DESTINATION_SLUGS.map(s => `${BASE}/transfers/${s}`);

const ALL_URLS = [...CORE_URLS, ...TOOL_URLS, ...STATIC_TRANSFER_URLS, ...DYNAMIC_URLS];

console.log(`\n🚀 Élite BCN — Search Engine Submission`);
console.log(`   Total URLs: ${ALL_URLS.length}`);
console.log(`   Site: ${BASE}\n`);

// ── Helper ────────────────────────────────────────────────────────────────────
async function post(label, url, body, headers = {}) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => "");
    const status = res.status;
    const ok = status >= 200 && status < 300;
    console.log(`  ${ok ? "✓" : "✗"} ${label}: HTTP ${status}${text ? " — " + text.slice(0, 120) : ""}`);
    return ok;
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message}`);
    return false;
  }
}

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

// ── 1. IndexNow — Bing (primary, distributes to Yandex/Seznam/Naver/Mojeek) ──
async function submitIndexNow() {
  console.log("━━ IndexNow (Bing → Yandex, Seznam, Naver, Mojeek) ━━");
  await post(
    "IndexNow bulk submit",
    "https://api.indexnow.org/indexnow",
    {
      host: "www.elitebcn.info",
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: ALL_URLS,
    }
  );
}

// ── 2. Bing Webmaster — sitemap ping ─────────────────────────────────────────
async function submitBingSitemap() {
  console.log("\n━━ Bing Webmaster — sitemap ping ━━");
  await ping(
    "Bing sitemap ping",
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`
  );
}

// ── 3. Google — sitemap ping (deprecated but still works) ────────────────────
async function submitGoogleSitemap() {
  console.log("\n━━ Google — sitemap ping ━━");
  await ping(
    "Google sitemap ping",
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP)}`
  );
}

// ── 4. Yandex — IndexNow direct endpoint ─────────────────────────────────────
async function submitYandex() {
  console.log("\n━━ Yandex IndexNow (direct) ━━");
  await post(
    "Yandex IndexNow",
    "https://yandex.com/indexnow",
    {
      host: "www.elitebcn.info",
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: ALL_URLS,
    }
  );
}

// ── 5. Seznam — IndexNow direct endpoint ─────────────────────────────────────
async function submitSeznam() {
  console.log("\n━━ Seznam IndexNow (direct) ━━");
  await post(
    "Seznam IndexNow",
    "https://search.seznam.cz/indexnow",
    {
      host: "www.elitebcn.info",
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: ALL_URLS,
    }
  );
}

// ── 6. Naver — IndexNow direct endpoint ──────────────────────────────────────
async function submitNaver() {
  console.log("\n━━ Naver IndexNow (direct) ━━");
  await post(
    "Naver IndexNow",
    "https://searchadvisor.naver.com/indexnow",
    {
      host: "www.elitebcn.info",
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: ALL_URLS,
    }
  );
}

// ── 7. Mojeek — IndexNow direct endpoint ─────────────────────────────────────
async function submitMojeek() {
  console.log("\n━━ Mojeek IndexNow (direct) ━━");
  await post(
    "Mojeek IndexNow",
    "https://www.mojeek.com/indexnow",
    {
      host: "www.elitebcn.info",
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: ALL_URLS,
    }
  );
}

// ── 8. Print summary of manual steps needed ───────────────────────────────────
function printManualSteps() {
  console.log(`
━━ Manual steps (one-time, if not done yet) ━━

  Google Search Console  → https://search.google.com/search-console
    • Verify ownership (DNS TXT or HTML file already in /public)
    • Sitemaps → Add → ${SITEMAP}
    • Request indexing for top priority URLs via URL Inspection

  Bing Webmaster Tools   → https://www.bing.com/webmasters
    • Verify ownership
    • Sitemaps → Submit → ${SITEMAP}
    • Connect your GSC account (auto-imports Google data)

  Yandex Webmaster       → https://webmaster.yandex.com
    • Verify ownership
    • Indexing → Sitemap files → Add → ${SITEMAP}

  Baidu Zhanzhang        → https://zhanzhang.baidu.com
    • Verify + submit sitemap (separate API key needed)
    • Most relevant if you want Chinese tourist traffic

  DuckDuckGo / Yahoo / Ecosia / Startpage
    • These use Bing or Google indexes — covered by steps above.
    • No separate submission needed.
`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  await submitIndexNow();
  await submitBingSitemap();
  await submitGoogleSitemap();
  await submitYandex();
  await submitSeznam();
  await submitNaver();
  await submitMojeek();
  printManualSteps();
  console.log("Done.\n");
})();
