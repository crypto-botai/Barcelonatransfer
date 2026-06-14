/**
 * DB-backed API key manager with AES-256-GCM encryption.
 * Keys are encrypted at rest in admin_api_keys table.
 * Rotating cooldown: 24h after any failure, auto-revived on next success.
 * 60s in-memory cache to avoid hammering the DB on every AI call.
 */
import { prisma } from "@/lib/prisma";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function encKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? "";
  if (!secret) throw new Error("API_KEY_ENCRYPTION_SECRET env var not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptKey(plaintext: string): string {
  const key    = encKey();
  const iv     = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptKey(stored: string): string {
  const key              = encKey();
  const [ivH, tagH, encH] = stored.split(":");
  if (!ivH || !tagH || !encH) throw new Error("Invalid encrypted key format");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivH, "hex"));
  decipher.setAuthTag(Buffer.from(tagH, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encH, "hex")), decipher.final()]).toString("utf8");
}

// ─── 60s in-memory cache ─────────────────────────────────────────────────────

interface CachedRow {
  id: string; encryptedKey: string; assignedAgent: string; label: string;
}
interface CacheEntry { rows: CachedRow[]; at: number }
const CACHE = new Map<string, CacheEntry>();
const TTL   = 60_000;

function bust() { CACHE.clear(); }

async function liveRows(provider: string): Promise<CachedRow[]> {
  const hit = CACHE.get(provider);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;

  const rows = await prisma.adminApiKey.findMany({
    where: {
      provider,
      status:    "live",
      isEnabled: true,
      OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: new Date() } }],
    },
    orderBy: { requestCount: "asc" },
    select:  { id: true, encryptedKey: true, assignedAgent: true, label: true },
  });

  CACHE.set(provider, { rows, at: Date.now() });
  return rows;
}

// ─── Public pick / track ──────────────────────────────────────────────────────

/**
 * Pick the best live DB key for a provider+agent pair.
 * Prefers keys assigned to the agent; falls back to pool keys.
 * Returns null if no live DB key available — caller should use env var.
 */
export async function pickKey(
  provider:  string,
  agentName: string = "pool",
): Promise<{ id: string; rawKey: string } | null> {
  const rows = await liveRows(provider);
  if (!rows.length) return null;

  const pick =
    rows.find(r => r.assignedAgent === agentName) ??
    rows.find(r => r.assignedAgent === "pool") ??
    rows[0];

  try {
    return { id: pick.id, rawKey: decryptKey(pick.encryptedKey) };
  } catch {
    return null;
  }
}

/** Mark a DB key cooling for 24h after failure. */
export async function markDbKeyFailed(id: string, error: string): Promise<void> {
  const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.adminApiKey.update({
    where: { id },
    data:  { status: "cooling", cooldownUntil, lastError: error.slice(0, 500) },
  }).catch(() => {});
  bust();
}

/** Mark a DB key live after a successful call. */
export async function markDbKeySuccess(id: string): Promise<void> {
  await prisma.adminApiKey.update({
    where: { id },
    data: {
      status:       "live",
      cooldownUntil: null,
      lastError:    null,
      lastUsedAt:   new Date(),
      requestCount: { increment: 1 },
    },
  }).catch(() => {});
}

/** Revive cooling keys whose cooldown has expired (call from cron). */
export async function reviveCooledKeys(): Promise<number> {
  const { count } = await prisma.adminApiKey.updateMany({
    where: { status: "cooling", cooldownUntil: { lt: new Date() } },
    data:  { status: "live", cooldownUntil: null },
  });
  if (count) bust();
  return count;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addKey(opts: {
  provider:      string;
  label:         string;
  rawKey:        string;
  assignedAgent: string;
}): Promise<string> {
  const row = await prisma.adminApiKey.create({
    data: {
      provider:      opts.provider,
      label:         opts.label,
      encryptedKey:  encryptKey(opts.rawKey),
      assignedAgent: opts.assignedAgent,
    },
  });
  bust();
  return row.id;
}

/** Seed DB from env vars. Checks multiple naming conventions. */
export async function seedKeysFromEnv(): Promise<{ added: number; skipped: number }> {
  // Each entry: provider name + ordered list of env var names to try
  const defs: Array<{ provider: string; vars: string[] }> = [
    {
      provider: "groq",
      vars: [
        // Standard format
        "GROQ_KEY_1","GROQ_KEY_2","GROQ_KEY_3","GROQ_KEY_4","GROQ_KEY_5",
        // Vercel lowercase format (gorq / gorq2 / gorq3 / gorq4)
        "gorq","gorq2","gorq3","gorq4",
        // Alternate spellings
        "GROQ_1","GROQ_2","GROQ_3","GROQ_4",
        "groq1","groq2","groq3","groq4",
      ],
    },
    {
      provider: "gemini",
      vars: [
        // Standard format
        "GEMINI_KEY_1","GEMINI_KEY_2","GEMINI_KEY_3","GEMINI_KEY_4","GEMINI_KEY_5",
        // Vercel lowercase format (gemini1 / gemini2 / gemini3 / gemini4)
        "gemini1","gemini2","gemini3","gemini4",
        // Alternate spellings
        "GEMINI_1","GEMINI_2","GEMINI_3","GEMINI_4",
        "GOOGLE_AI_KEY",
      ],
    },
    {
      provider: "openrouter",
      vars: [
        "OPENROUTER_KEY_1","OPENROUTER_KEY_2","OPENROUTER_KEY_3","OPENROUTER_KEY_4",
        "openrouter1","openrouter2","openrouter3","openrouter4",
        "OPENROUTER_1","OPENROUTER_2","OPENROUTER_3","OPENROUTER_4",
      ],
    },
  ];

  let added = 0, skipped = 0, seq = 0;

  for (const { provider, vars } of defs) {
    seq = 0;
    const seen = new Set<string>(); // deduplicate by raw value
    for (const envName of vars) {
      const raw = process.env[envName];
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      seq++;

      const label    = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Key ${seq}`;
      const existing = await prisma.adminApiKey.findFirst({ where: { provider, label } });
      if (existing) { skipped++; continue; }

      await addKey({ provider, label, rawKey: raw, assignedAgent: "pool" });
      added++;
    }
  }

  return { added, skipped };
}

/** All keys for admin dashboard (encrypted field NOT included). */
export async function getKeyHealthSnapshot() {
  return prisma.adminApiKey.findMany({
    orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, provider: true, label: true, assignedAgent: true,
      status: true, cooldownUntil: true, lastUsedAt: true,
      lastError: true, requestCount: true, isEnabled: true, createdAt: true,
    },
  });
}

// ─── Key test ─────────────────────────────────────────────────────────────────

const TEST_CONFIGS: Record<string, { url: string; model: string; extra?: Record<string, string> }> = {
  groq: {
    url:   "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
  },
  gemini: {
    url:   "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash-lite",
  },
  openrouter: {
    url:   "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.2-3b-instruct:free",
    extra: { "HTTP-Referer": "https://www.elitebcn.info", "X-Title": "Elite BCN" },
  },
};

export async function testRawKey(
  provider: string,
  rawKey:   string,
): Promise<{ ok: boolean; warning?: string; error?: string; latencyMs: number }> {
  const cfg = TEST_CONFIGS[provider];
  if (!cfg) return { ok: false, error: `Unknown provider: ${provider}`, latencyMs: 0 };

  const t0 = Date.now();
  try {
    const res = await fetch(cfg.url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${rawKey}`,
        ...(cfg.extra ?? {}),
      },
      body: JSON.stringify({
        model:       cfg.model,
        messages:    [{ role: "user", content: "Say OK" }],
        max_tokens:  5,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const ms = Date.now() - t0;

    // 429 = key is valid but rate-limited or quota exhausted — still save it
    if (res.status === 429) {
      return { ok: true, warning: "Rate limited / quota hit — key saved but may need quota top-up", latencyMs: ms };
    }

    // 401 / 403 = key is genuinely invalid
    if (res.status === 401 || res.status === 403) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Invalid key (HTTP ${res.status}): ${body.slice(0, 150)}`, latencyMs: ms };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}`, latencyMs: ms };
    }

    return { ok: true, latencyMs: ms };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - t0 };
  }
}
