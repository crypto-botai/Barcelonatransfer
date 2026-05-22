/**
 * Google Indexing API — submit all site URLs
 * Requires service account with Owner access in Search Console
 * Run: node scripts/submit-indexing.mjs
 */

import { createSign } from "crypto";

// ─── Service Account Credentials ────────────────────────────
const SA = {
  type: "service_account",
  project_id: "velore-website-496619",
  private_key_id: "e6dc5cd3b0476fee74a2183008ba56eeaff1e3d7",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC5tI59BXX4eYA0
rbozW0a1GpiqHjAKaIb1y/V35svJLlNNd6pyr/IDV7ageVajmDycvetfyJPmg5bg
BZKhDtZYyO2FOSq0EXcEiZfG9E3MwpwtiAZCDvTeyXeXNO2vLh+NR6yoE4wQKoKI
VKIRMg5NIu/7VvoJmJp9amgw4ct4kOJVMBzeHQH+t4OtCCHpQDLJczhJJJMlF9i1
LtrBbP9tUiCFvGS3OiG6MKob/IHOcsUg4D2387Gu3iLBkeI+ll/mHlpINu23K5VM
iYmiI3xqvPjymrB2F2c06QYYd6smmUsms9AJ0EJ78CayBiqk8mEgAiAvC+1C9r+/
HJ+E7R0hAgMBAAECggEASVspbflaQGy+WBDIHMFRjPiUlZ6XG4Vuymlm7ZYdqbrC
7Tb3/ZXC488iNQG5V6YrSz86WvvAcK5KSvPol/ZkdW3pZVbPp5G+kexIKC8ZDGlT
iCjTUATYdajftLsTqL9vdz941GvkR/6C0Zec7W34eD/0zDPvURsW67O8tJJ87YKh
nwNIFqmMjkjpKHTFvYHfJsn3NlAoL1OlooYQAvwO/EjHtA5L0BDETN6ujDudU6wf
bC2P0Crw/rbZkEErOkHom0sVEOgvigIHS+hdldVUDpKnnewZaP9P3EFVw2cLGwkn
sxElxQgQOcssTF5+dvD9EkwApbidPe2GoBLKL5xEgQKBgQDdBe1v7b6glHAYIPBx
j3WwToy+/RJJ7RSdkijFZr6DrKxffuQPvs35FJfsVIOqA7BAicVtxUdNKcYJ4qf8
KT9XZVG1ZJWwg6e+3dYYHo6W1/H+YecZ8xVu+hj7nRQ0yOC2b43CZGoMt3hKyP3X
T3EOCUadcR9mE2d+FQJRlH/yxwKBgQDXF9W//DgPOLO6K0hHvqkABWku7lUR2M4t
oIjoA4qMSHtPxcHdsE7YS2G537zIc6U3dHv/wLpN9QlNA1s6njqGeVOaK30pFemP
aXun9aEj358XMoYbNTxD5xo55rF6xpQpy8m5QPNy0m/jRaSKLr8mHy/F9+Yrgv5I
LNuMQQ4I1wKBgATuOuvCS/xdE1sWcQa3gpKaTf18u8m2Zj1Vo18z+ZAKbBX9SK0p
PoMN+I2nHQDP8ECgUi0ut3Z7NhXGXqT7bpROiFIZmlVDupxBaqNDGz82NgnMuVEU
4SeGoMQMLwU2bfzj5C+v+cWq2h4g+bix5v2/Kzob6e1nBWoEofab73bFAoGAU4Hp
dtQRX7d/77OGKHSZYGy5XYMie/9UbNp6zLkzPSuW1G3Oyqb8tXTuyB9ZR+m+Jz2O
Nsk4i7OqnL/E14k+556LGrvvp9feCdPGMntmyGq1dWgkMMQGVcaPpBMwrJ4UP/Xi
p43T9qxEzFPpgcyMYdyRy6ZnMlV1K8hepKFNNZkCgYBq5nTi6Ka+jLCzKnBOL2/o
7mmOMhfu3NZRxWOEIHMmfNiG/UaRnZopQByQTu5gHcQuf7FoS3Kr79WJbmCWz6ZK
aOjjsFQFERwOpnmEJUmIsr6ZYY40sKMnKMwHJTUCfTvZe8DGdaLNfRN1u8XAdk2i
g5ueckNmjeyCGPEQOtlsTg==
-----END PRIVATE KEY-----`,
  client_email: "elite-cn@velore-website-496619.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token",
};

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
  console.log("\n🚀 Élite BCN — Google Indexing API Submission");
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
