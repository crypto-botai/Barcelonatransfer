/**
 * Google Indexing API — submit all site URLs
 * Requires service account with Owner access in Search Console
 * Run: node scripts/submit-indexing.mjs
 */

import { createSign } from "crypto";

// ─── Service Account Credentials ────────────────────────────
//
// Read from the environment. A key was committed here in plain text while the
// repository was public, so that credential is disclosed and must be revoked
// in Google Cloud — removing it from this file does not undo it, since it
// stays in the git history.
//
// Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY in .env.local. Escaped
// newlines are accepted, which is how the key usually arrives when pasted into
// an environment variable.
const SA = {
  client_email: process.env.GOOGLE_SA_CLIENT_EMAIL,
  private_key:  (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  token_uri:    "https://oauth2.googleapis.com/token",
};

if (!SA.client_email || !SA.private_key) {
  console.error(
    "Missing credentials.\n\n" +
    "  GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY must be set.\n" +
    "  Create a NEW service account key — the one that used to be in this\n" +
    "  file was public on GitHub and should be deleted in Google Cloud.\n\n" +
    "  Run with: npx dotenv -e .env.local -- node scripts/submit-indexing.mjs\n",
  );
  process.exit(1);
}

// ─── All pages to submit ─────────────────────────────────────
const BASE = "https://www.elitebcn.info";
const URLS = [
  // Core — highest priority
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
  // Destination landing pages
  `${BASE}/transfers`,
  `${BASE}/transfers/sitges`,
  `${BASE}/transfers/girona`,
  `${BASE}/transfers/montserrat`,
  `${BASE}/transfers/costa-brava`,
  `${BASE}/transfers/tarragona`,
  `${BASE}/transfers/andorra`,
  `${BASE}/transfers/cruise-port`,
  `${BASE}/transfers/port-aventura`,
  // Legal
  `${BASE}/privacy`,
  `${BASE}/terms`,
  `${BASE}/cookies`,
];

// ─── Create signed JWT ────────────────────────────────────────
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss:  SA.client_email,
    scope: "https://www.googleapis.com/auth/indexing",
    aud:  SA.token_uri,
    iat:  now,
    exp:  now + 3600,
  })).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const sig = signer.sign(SA.private_key, "base64url");
  return `${signingInput}.${sig}`;
}

// ─── Exchange JWT for access token ───────────────────────────
async function getAccessToken() {
  const jwt = createJWT();
  const res = await fetch(SA.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error("❌ Token error:", JSON.stringify(data));
    process.exit(1);
  }
  return data.access_token;
}

// ─── Submit a single URL ──────────────────────────────────────
async function submitURL(url, token) {
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Elite BCN — Google Indexing API Submission");
  console.log("━".repeat(55));
  console.log(`📋 Submitting ${URLS.length} URLs...\n`);

  const token = await getAccessToken();
  console.log("✅ Access token obtained\n");

  let ok = 0;
  let fail = 0;

  for (const url of URLS) {
    const { status, data } = await submitURL(url, token);
    const short = url.replace(BASE, "");

    if (status === 200) {
      const ts = data.urlNotificationMetadata?.latestUpdate?.notifyTime ?? "";
      console.log(`  ✅ ${(short || "/").padEnd(40)} 200 OK  ${ts ? new Date(ts).toISOString().slice(0,19) : ""}`);
      ok++;
    } else if (status === 403) {
      console.log(`  ❌ ${(short || "/").padEnd(40)} 403 FORBIDDEN — service account not Owner in GSC`);
      fail++;
      if (fail === 1) {
        console.log("\n  ⚠️  ACTION NEEDED:");
        console.log("  Go to Search Console → Settings → Users and permissions");
        console.log("  Add: elite-cn@velore-website-496619.iam.gserviceaccount.com");
        console.log("  Role: Owner  →  then re-run this script\n");
        break;
      }
    } else if (status === 429) {
      console.log(`  ⏳ ${(short || "/").padEnd(40)} 429 RATE LIMITED — waiting 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      // retry once
      const retry = await submitURL(url, token);
      if (retry.status === 200) { console.log(`  ✅ ${(short || "/").padEnd(40)} 200 OK (retry)`); ok++; }
      else { console.log(`  ❌ ${(short || "/").padEnd(40)} ${retry.status} FAILED`); fail++; }
    } else {
      console.log(`  ❌ ${(short || "/").padEnd(40)} ${status} — ${JSON.stringify(data).slice(0, 80)}`);
      fail++;
    }

    // Small delay to respect rate limits (200 req/day limit)
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("\n" + "━".repeat(55));
  console.log(`✅ Success: ${ok}/${URLS.length}  |  ❌ Failed: ${fail}/${URLS.length}`);
  if (ok === URLS.length) {
    console.log("\n🎉 All pages submitted to Google! Indexing begins within 24–72 hours.");
    console.log("   Check progress at: https://search.google.com/search-console");
  }
  console.log();
}

main().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
