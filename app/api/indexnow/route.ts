import { NextResponse } from "next/server";

const BASE      = "https://www.elitebcn.info";
const INDEXNOW_KEY = "elitebcn7a4b2c1d9e3f8a05";
const KEY_LOC   = `${BASE}/${INDEXNOW_KEY}.txt`;

// All indexable URLs
const ALL_URLS = [
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
  `${BASE}/vip-transportation`,
  `${BASE}/day-tours`,
  `${BASE}/hotel-transfers`,
  `${BASE}/transfers`,
  `${BASE}/transfers/sitges`,
  `${BASE}/transfers/girona`,
  `${BASE}/transfers/montserrat`,
  `${BASE}/transfers/costa-brava`,
  `${BASE}/transfers/tarragona`,
  `${BASE}/transfers/andorra`,
  `${BASE}/transfers/cruise-port`,
  `${BASE}/transfers/port-aventura`,
  `${BASE}/fleet/standard-sedan`,
  `${BASE}/fleet/eqe-300-electric`,
  `${BASE}/fleet/executive-minivan`,
  `${BASE}/fleet/luxury-minivan`,
  `${BASE}/fleet/group-minibus`,
  `${BASE}/fleet/tesla-model-3`,
  `${BASE}/fleet/business-sedan`,
  `${BASE}/tools/transfer-cost-calculator`,
];

// POST /api/indexnow — callable from a cron job or webhook
export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  const adminSecret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!adminSecret || authHeader !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return submitToIndexNow();
}

// GET /api/indexnow — for manual triggering from admin panel (no auth required for read)
export async function GET() {
  return submitToIndexNow();
}

async function submitToIndexNow() {
  try {
    const payload = {
      host:        "www.elitebcn.info",
      key:         INDEXNOW_KEY,
      keyLocation: KEY_LOC,
      urlList:     ALL_URLS,
    };

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method:  "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body:    JSON.stringify(payload),
    });

    if (res.ok || res.status === 202) {
      return NextResponse.json({
        success:  true,
        status:   res.status,
        urls:     ALL_URLS.length,
        message:  `Submitted ${ALL_URLS.length} URLs to IndexNow (Bing, Yandex, DuckDuckGo, Naver, Sogou)`,
      });
    }

    const text = await res.text().catch(() => "");
    return NextResponse.json({ success: false, status: res.status, error: text }, { status: 500 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
