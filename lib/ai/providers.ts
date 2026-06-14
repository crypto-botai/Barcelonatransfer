/**
 * Multi-provider AI client — NVIDIA NIM primary, 11 providers as fallback pool.
 * All providers use the OpenAI-compatible chat completions format.
 *
 * ─── AGENT → PRIMARY PROVIDER ────────────────────────────────────────────────
 *   support      → Kimi K2.6  (NVIDIA_KIMI_KEY)
 *   booking      → DeepSeek V4 Pro (NVIDIA_DEEPSEEK_KEY)
 *   orchestrator → Mistral Medium 3.5 (NVIDIA_MISTRAL_KEY)
 *   health       → OpenRouter (OPENROUTER_API_KEY)
 *   seo          → Gemma 4 31B (NVIDIA_MISTRAL_KEY — shared, own key not needed)
 *   analytics    → GitHub Models (GITHUB_AI_TOKEN)
 *   marketing    → MiniMax M3 (NVIDIA_MINIMAX_KEY)
 *   knowledge    → GLM 5.1 (NVIDIA_GLM_KEY)
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
  support:      "kimi",          // complex: keep NVIDIA NIM quality
  booking:      "deepseek",      // complex: needs best reasoning
  orchestrator: "groq",          // orchestration: fast, free, no credit burn
  health:       "groq",          // light task: groq free is fast + reliable
  seo:          "groq",          // light task: groq free
  analytics:    "groq",          // light task: groq free
  marketing:    "minimax",       // creative: NVIDIA NIM gives best quality
  knowledge:    "glm",           // knowledge: NVIDIA NIM GLM
};

// ─── Ordered fallback chains per agent ───────────────────────────────────────
// STRATEGY:
//   • Light tasks (health, seo, analytics, orchestrator): FREE-FIRST
//     → groq → gemini → github → openrouter → NVIDIA NIM → paid as last resort
//   • Heavy tasks (booking, support, knowledge, marketing): QUALITY-FIRST
//     → NVIDIA NIM primaries → groq/gemini fallback → paid last resort
//
// This conserves NVIDIA NIM credits for tasks that need quality reasoning.
// Groq (Llama 3.1), Gemini Flash, GitHub (GPT-4o-mini) are rate-limited but free.
const FALLBACK_CHAIN: Record<string, string[]> = {
  // ── Light tasks — free models first, NVIDIA NIM as backup ─────────────────
  health:       ["groq", "gemini", "github", "openrouter", "glm",    "nvidia_mistral", "mistral"],
  seo:          ["groq", "gemini", "github", "openrouter", "gemma",  "nvidia_mistral", "mistral"],
  analytics:    ["groq", "gemini", "github", "openrouter", "kimi",   "deepseek",       "mistral"],
  orchestrator: ["groq", "gemini", "github",               "nvidia_mistral", "mistral", "kimi"],

  // ── Quality tasks — NVIDIA NIM first, free models as fallback ─────────────
  support:      ["kimi", "glm", "deepseek", "minimax", "nvidia_mistral", "groq", "gemini", "openrouter"],
  booking:      ["deepseek", "kimi", "nvidia_mistral", "glm",   "groq", "gemini", "mistral", "cerebras"],
  marketing:    ["minimax",  "kimi", "glm", "nvidia_mistral",   "groq", "gemini"],
  knowledge:    ["glm",      "kimi", "minimax", "nvidia_mistral","groq", "gemini"],
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveChain(agentName: string): ProviderDef[] {
  const chain = FALLBACK_CHAIN[agentName] ?? ["kimi", "groq"];
  return chain
    .map((k) => PROVIDERS[k])
    .filter((p): p is ProviderDef => {
      if (!p) return false;
      if (!process.env[p.envKey]) return false;          // key not configured
      if (getKeyStatus(p.envKey, p.label) === "dead") return false; // permanently dead
      return true;
    });
}

function apiKey(p: ProviderDef): string {
  const k = process.env[p.envKey] ?? "";
  if (!k) throw new Error(`Missing env var ${p.envKey}`);
  return k;
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
    // Skip cooling keys (will be auto-revived by keyManager on next status check)
    if (getKeyStatus(p.envKey, p.label) === "cooling") continue;

    const t0 = Date.now();
    try {
      const key = apiKey(p);
      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, key),
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
        markFailed(p.envKey, reason, p.label);
        lastError = new Error(`[${p.label}] ${reason}`);
        if (isTransient) continue; // try next provider
        throw lastError;           // non-transient error — stop
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?:   { prompt_tokens?: number; completion_tokens?: number };
      };

      const text         = data.choices?.[0]?.message?.content ?? "";
      const inputTokens  = data.usage?.prompt_tokens     ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const costCents    = computeCost(p, inputTokens, outputTokens);

      markSuccess(p.envKey, latency, p.label);

      return { text, inputTokens, outputTokens, costCents, provider: p.label, model: p.model, latencyMs: latency };

    } catch (err) {
      const latency = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);

      if ((err as Error).name === "TimeoutError") {
        markFailed(p.envKey, `Timeout after ${latency}ms`, p.label);
        lastError = new Error(`[${p.label}] Timeout`);
        continue;
      }
      if (msg.includes("Missing env var")) {
        continue; // already filtered by resolveChain but be safe
      }
      // Already marked failed above for HTTP errors — re-throw non-transient
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

    const t0 = Date.now();
    try {
      const key = apiKey(p);

      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, key),
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
        markFailed(p.envKey, `HTTP ${res.status}`, p.label);
        lastError = new Error(`[${p.label}] HTTP ${res.status}`);
        if (isTransient) continue;
        throw lastError;
      }

      // Successfully connected — stream from this provider
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

      markSuccess(p.envKey, latency, p.label);

      yield { type: "done", inputTokens, outputTokens, costCents, provider: p.label, model: p.model, latencyMs: latency };
      return;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if ((err as Error).name === "TimeoutError") {
        markFailed(p.envKey, "Stream timeout", p.label);
        lastError = new Error(`[${p.label}] Stream timeout`);
        continue;
      }
      lastError = err instanceof Error ? err : new Error(msg);
      if (msg.includes("Missing env var")) continue;
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
