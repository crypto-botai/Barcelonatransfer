/**
 * Multi-provider AI client — Groq + Gemini primary, with fallback pool.
 * All providers use the OpenAI-compatible chat completions format.
 *
 * ─── AGENT → PRIMARY PROVIDER ────────────────────────────────────────────────
 *   support      → Groq Llama  (GROQ_API_KEY / DB pool)
 *   booking      → Groq Llama  (GROQ_API_KEY / DB pool)
 *   orchestrator → Groq Llama  (GROQ_API_KEY / DB pool)
 *   health       → Groq Llama  (GROQ_API_KEY / DB pool)
 *   seo          → Groq Llama  (GROQ_API_KEY / DB pool)
 *   analytics    → Groq Llama  (GROQ_API_KEY / DB pool)
 *   marketing    → Gemini Flash (GOOGLE_AI_KEY / DB pool)
 *   knowledge    → Groq Llama  (GROQ_API_KEY / DB pool)
 *
 * ─── KEY HEALTH ──────────────────────────────────────────────────────────────
 * Uses keyManager.ts for per-key cooldown / dead tracking.
 * Cooling or dead keys are SKIPPED immediately — no wasted timeout.
 * On success → markSuccess() (latency tracking, failure count recovery)
 * On failure → markFailed() (exponential back-off, eventual dead marking)
 *
 * ─── COST TRACKING ───────────────────────────────────────────────────────────
 * centsPerMToken: estimated cost in USD cents per million tokens (input+output).
 * NVIDIA NIM, Groq, GitHub, OpenRouter (free models), Gemini = 0 (free tier).
 * Cerebras / Mistral paid tiers carry a small estimate.
 * Update this table when upgrading to paid tiers.
 */

import { getKeyStatus, markSuccess, markFailed } from "@/lib/ai/keyManager";
import { pickKey, markDbKeyFailed, markDbKeySuccess } from "@/lib/ai/dbKeyManager";

export type AgentName =
  | "support"
  | "booking"
  | "orchestrator"
  | "health"
  | "seo"
  | "analytics"
  | "marketing"
  | "knowledge";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallResult {
  text:         string;
  inputTokens:  number;
  outputTokens: number;
  costCents:    number;
  provider:     string;
  model:        string;
  latencyMs:    number;
}

interface ProviderDef {
  key:            string;          // internal key in PROVIDERS map
  label:          string;
  baseURL:        string;
  envKey:         string;          // env var holding the API key
  model:          string;
  maxTokens:      number;
  centsPerMToken: number;          // USD cents per million tokens (0 = free tier)
  extraHeaders?:  Record<string, string>;
  extraBody?:     Record<string, unknown>;
}

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

// ─── Provider catalogue ───────────────────────────────────────────────────────
// Add new providers here. Set centsPerMToken = 0 for free tiers.

const PROVIDERS: Record<string, ProviderDef> = {
  // ── NVIDIA NIM (primary tier — 5 separate keys) ────────────────────────────
  kimi: {
    key: "kimi", label: "Kimi K2.6", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_KIMI_KEY", model: "moonshotai/kimi-k2.6",
    maxTokens: 16384, centsPerMToken: 0,
  },
  deepseek: {
    key: "deepseek", label: "DeepSeek V4 Pro", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_DEEPSEEK_KEY", model: "deepseek-ai/deepseek-v4-pro",
    maxTokens: 16384, centsPerMToken: 0,
    extraBody: { chat_template_kwargs: { thinking: false } },
  },
  glm: {
    key: "glm", label: "GLM 5.1", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_GLM_KEY", model: "z-ai/glm-5.1",
    maxTokens: 16384, centsPerMToken: 0,
  },
  minimax: {
    key: "minimax", label: "MiniMax M3", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MINIMAX_KEY", model: "minimaxai/minimax-m3",
    maxTokens: 8192, centsPerMToken: 0,
  },
  nvidia_mistral: {
    key: "nvidia_mistral", label: "Mistral Medium 3.5", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MISTRAL_KEY", model: "mistralai/mistral-medium-3.5-128b",
    maxTokens: 16384, centsPerMToken: 0,
  },
  // Gemma 4 shares NVIDIA_MISTRAL_KEY (both are NVIDIA NIM credits).
  // If you add a dedicated key later, change envKey to "NVIDIA_GEMMA_KEY".
  gemma: {
    key: "gemma", label: "Gemma 4 31B", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MISTRAL_KEY", model: "google/gemma-4-31b-it",
    maxTokens: 16384, centsPerMToken: 0,
  },

  // ── Fallback / secondary providers ─────────────────────────────────────────
  groq: {
    key: "groq", label: "Groq Llama", baseURL: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY", model: "llama-3.1-8b-instant",
    maxTokens: 1024, centsPerMToken: 0,
  },
  cerebras: {
    key: "cerebras", label: "Cerebras", baseURL: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY", model: "llama-3.3-70b",
    maxTokens: 1024, centsPerMToken: 18,  // ~$0.18/M tokens
  },
  mistral: {
    key: "mistral", label: "Mistral Small", baseURL: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY", model: "mistral-small-latest",
    maxTokens: 1024, centsPerMToken: 20,  // ~$0.20/M tokens
  },
  openrouter: {
    key: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY", model: "meta-llama/llama-3.2-3b-instruct:free",
    maxTokens: 1024, centsPerMToken: 0,
    extraHeaders: {
      "HTTP-Referer": "https://www.elitebcn.info",
      "X-Title":      "Elite BCN Transfers",
    },
  },
  gemini: {
    key: "gemini", label: "Gemini Flash", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GOOGLE_AI_KEY", model: "gemini-2.0-flash-lite",
    maxTokens: 1024, centsPerMToken: 0,
  },
  github: {
    key: "github", label: "GitHub Models", baseURL: "https://models.inference.ai.azure.com",
    envKey: "GITHUB_AI_TOKEN", model: "gpt-4o-mini",
    maxTokens: 1024, centsPerMToken: 0,
  },
  opencode: {
    key: "opencode", label: "OpenCode", baseURL: "https://api.openai.com/v1",
    envKey: "OPENCODE_API_KEY", model: "gpt-4o-mini",
    maxTokens: 1024, centsPerMToken: 20,
  },
};

// ─── Primary provider per agent ───────────────────────────────────────────────
// "Primary" = first live key tried. Display only — actual routing from FALLBACK_CHAIN.
export const AGENT_PROVIDER: Record<AgentName, string> = {
  support:      "groq",
  booking:      "groq",
  orchestrator: "groq",
  health:       "groq",
  seo:          "groq",
  analytics:    "groq",
  marketing:    "gemini",
  knowledge:    "groq",
};

// ─── Ordered fallback chains per agent ───────────────────────────────────────
// STRATEGY: Groq DB pool → Gemini DB pool → OpenRouter free → GitHub free → paid last resort
// DB keys (from admin_api_keys table, seeded via /admin/api-keys) are tried first.
const FALLBACK_CHAIN: Record<string, string[]> = {
  health:       ["groq", "gemini", "openrouter", "github", "mistral"],
  seo:          ["groq", "gemini", "openrouter", "github", "mistral"],
  analytics:    ["groq", "gemini", "openrouter", "github", "mistral"],
  orchestrator: ["groq", "gemini", "openrouter", "github", "mistral"],
  support:      ["groq", "gemini", "openrouter", "github", "mistral"],
  booking:      ["groq", "gemini", "openrouter", "github", "mistral"],
  marketing:    ["gemini", "groq", "openrouter", "github", "mistral"],
  knowledge:    ["groq", "gemini", "openrouter", "github", "mistral"],
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveChain(agentName: string): ProviderDef[] {
  const chain = FALLBACK_CHAIN[agentName] ?? ["groq", "gemini"];
  return chain
    .map((k) => PROVIDERS[k])
    .filter((p): p is ProviderDef => {
      if (!p) return false;
      if (!process.env[p.envKey]) return false;          // key not configured
      if (getKeyStatus(p.envKey, p.label) === "dead") return false; // permanently dead
      return true;
    });
}

function buildHeaders(p: ProviderDef, key: string): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${key}`,
    ...(p.extraHeaders ?? {}),
  };
}

/** Compute costCents from token usage and the provider's rate. */
function computeCost(p: ProviderDef, inputTokens: number, outputTokens: number): number {
  if (p.centsPerMToken === 0) return 0;
  return Math.ceil(((inputTokens + outputTokens) / 1_000_000) * p.centsPerMToken);
}

// ─── Non-streaming call with key-aware fallback ───────────────────────────────

export async function callProvider(
  agentName: string,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<CallResult> {
  const chain = resolveChain(agentName);
  if (!chain.length) throw new Error(`No live providers for agent: ${agentName}`);

  let lastError: Error = new Error("No providers attempted");

  for (const p of chain) {
    // Skip cooling env-var keys
    if (getKeyStatus(p.envKey, p.label) === "cooling") continue;

    // Prefer a DB key for this provider; fall back to single env-var key
    const dbEntry = await pickKey(p.key, agentName).catch(() => null);
    let rawKey: string;
    let dbKeyId: string | null = null;

    if (dbEntry) {
      rawKey  = dbEntry.rawKey;
      dbKeyId = dbEntry.id;
    } else {
      rawKey = process.env[p.envKey] ?? "";
      if (!rawKey) continue;
    }

    const t0 = Date.now();
    try {
      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, rawKey),
        body: JSON.stringify({
          model:       p.model,
          messages,
          max_tokens:  opts?.maxTokens ?? p.maxTokens,
          temperature: opts?.temperature ?? 0.3,
          ...(p.extraBody ?? {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const latency = Date.now() - t0;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const isTransient = res.status === 429 || res.status >= 500 || body.includes("quota") || body.includes("rate_limit");
        const reason = `HTTP ${res.status}: ${body.slice(0, 150)}`;
        if (dbKeyId) await markDbKeyFailed(dbKeyId, reason).catch(() => {});
        else markFailed(p.envKey, reason, p.label);
        lastError = new Error(`[${p.label}] ${reason}`);
        if (isTransient) continue;
        throw lastError;
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?:   { prompt_tokens?: number; completion_tokens?: number };
      };

      const text         = data.choices?.[0]?.message?.content ?? "";
      const inputTokens  = data.usage?.prompt_tokens     ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const costCents    = computeCost(p, inputTokens, outputTokens);

      if (dbKeyId) await markDbKeySuccess(dbKeyId).catch(() => {});
      else markSuccess(p.envKey, latency, p.label);

      return { text, inputTokens, outputTokens, costCents, provider: p.label, model: p.model, latencyMs: latency };

    } catch (err) {
      const latency = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);

      if ((err as Error).name === "TimeoutError") {
        const reason = `Timeout after ${latency}ms`;
        if (dbKeyId) await markDbKeyFailed(dbKeyId, reason).catch(() => {});
        else markFailed(p.envKey, reason, p.label);
        lastError = new Error(`[${p.label}] Timeout`);
        continue;
      }
      lastError = err instanceof Error ? err : new Error(msg);
    }
  }

  throw lastError;
}

// ─── Streaming call with key-aware fallback ───────────────────────────────────

export async function* streamProvider(
  agentName: string,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number },
): AsyncGenerator<
  | { type: "text"; text: string }
  | { type: "done"; inputTokens: number; outputTokens: number; costCents: number; provider: string; model: string; latencyMs: number }
> {
  const chain = resolveChain(agentName);
  if (!chain.length) throw new Error(`No live providers for agent: ${agentName}`);

  let lastError: Error = new Error("No providers attempted");

  for (const p of chain) {
    if (getKeyStatus(p.envKey, p.label) === "cooling") continue;

    const dbEntry = await pickKey(p.key, agentName).catch(() => null);
    let rawKey: string;
    let dbKeyId: string | null = null;

    if (dbEntry) {
      rawKey  = dbEntry.rawKey;
      dbKeyId = dbEntry.id;
    } else {
      rawKey = process.env[p.envKey] ?? "";
      if (!rawKey) continue;
    }

    const t0 = Date.now();
    try {
      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, rawKey),
        body: JSON.stringify({
          model:          p.model,
          messages,
          max_tokens:     opts?.maxTokens ?? p.maxTokens,
          temperature:    0.3,
          stream:         true,
          stream_options: { include_usage: true },
          ...(p.extraBody ?? {}),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const isTransient = res.status === 429 || res.status >= 500 || body.includes("quota");
        const reason = `HTTP ${res.status}`;
        if (dbKeyId) await markDbKeyFailed(dbKeyId, reason).catch(() => {});
        else markFailed(p.envKey, reason, p.label);
        lastError = new Error(`[${p.label}] ${reason}`);
        if (isTransient) continue;
        throw lastError;
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let sseBuffer    = "";
      let inputTokens  = 0;
      let outputTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const raw = trimmed.slice(6);
            if (raw === "[DONE]") continue;

            try {
              const chunk  = JSON.parse(raw) as {
                choices?: Array<{ delta?: { content?: string } }>;
                usage?:   { prompt_tokens?: number; completion_tokens?: number };
              };
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) yield { type: "text", text: delta };
              if (chunk.usage) {
                inputTokens  = chunk.usage.prompt_tokens    ?? inputTokens;
                outputTokens = chunk.usage.completion_tokens ?? outputTokens;
              }
            } catch { /* malformed SSE chunk — skip */ }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const latency   = Date.now() - t0;
      const costCents = computeCost(p, inputTokens, outputTokens);

      if (dbKeyId) await markDbKeySuccess(dbKeyId).catch(() => {});
      else markSuccess(p.envKey, latency, p.label);

      yield { type: "done", inputTokens, outputTokens, costCents, provider: p.label, model: p.model, latencyMs: latency };
      return;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((err as Error).name === "TimeoutError") {
        const reason = "Stream timeout";
        if (dbKeyId) await markDbKeyFailed(dbKeyId, reason).catch(() => {});
        else markFailed(p.envKey, reason, p.label);
        lastError = new Error(`[${p.label}] ${reason}`);
        continue;
      }
      lastError = err instanceof Error ? err : new Error(msg);
    }
  }

  throw lastError;
}

// ─── Provider info for admin dashboards ──────────────────────────────────────

export function getProviderInfo(): Array<{
  agent:      string;
  provider:   string;
  model:      string;
  envKey:     string;
  configured: boolean;
}> {
  return Object.entries(AGENT_PROVIDER).map(([agent, provKey]) => {
    const p = PROVIDERS[provKey];
    return {
      agent,
      provider:   p.label,
      model:      p.model,
      envKey:     p.envKey,
      configured: Boolean(process.env[p.envKey]),
    };
  });
}
