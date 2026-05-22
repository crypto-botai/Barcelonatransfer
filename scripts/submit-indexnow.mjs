/**
 * IndexNow — submit all URLs to Bing, Yandex, Google (via IndexNow protocol)
 * No authentication needed. Works immediately.
 */

const KEY  = "a1b2c3d4e5f6789012345678elitebcn";
const HOST = "www.elitebcn.info";
const BASE = `https://${HOST}`;

const URLS = [
  `${BASE}/`,
  `${BASE}/book`,
  `${BASE}/pricing`,
  `${BASE}/fleet`,
  `${BASE}/airport-transfers`,
  `${BASE}/corporate`,
  `${BASE}/hourly`,
  `${BASE}/faq`,
  `${BASE}/about`,
  `${BASE}/contact`,
  `${BASE}/transfers`,
  `${BASE}/transfers/sitges`,
  `${BASE}/transfers/girona`,
  `${BASE}/transfers/montserrat`,
  `${BASE}/transfers/costa-brava`,
  `${BASE}/transfers/tarragona`,
  `${BASE}/transfers/andorra`,
  `${BASE}/transfers/cruise-port`,
  `${BASE}/transfers/port-aventura`,
  `${BASE}/privacy`,
  `${BASE}/terms`,
  `${BASE}/cookies`,
];

const ENGINES = [
  { name: "Bing",    url: "https://api.indexnow.org/indexnow" },
  { name: "Yandex",  url: "https://yandex.com/indexnow" },
];

async function submitBatch(engineName, engineUrl) {
  const body = {
    host:    HOST,
    key:     KEY,
    keyLocation: `${BASE}/${KEY}.txt`,
    urlList: URLS,
  };

  const res = await fetch(engineUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (res.status === 200 || res.status === 202) {
    console.log(`  ✅ ${engineName.padEnd(10)} ${res.status} — ${URLS.length} URLs accepted`);
  } else {
    const text = await res.text().catch(() => "");
    console.log(`  ❌ ${engineName.padEnd(10)} ${res.status} — ${text.slice(0, 100)}`);
  }
}

console.log(`\n🚀 IndexNow Submission — ${URLS.length} URLs`);
console.log("━".repeat(50));

for (const engine of ENGINES) {
  await submitBatch(engine.name, engine.url);
}

console.log("━".repeat(50));
console.log("✅ Done. Bing and Yandex will crawl within hours.\n");
