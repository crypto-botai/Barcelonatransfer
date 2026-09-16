/**
 * Multi-provider AI client. Every provider speaks the OpenAI chat-completions
 * format, so one fetch shape serves all of them.
 *
 * ─── HOW A CALL IS ROUTED ────────────────────────────────────────────────────
 * Each agent has an ordered chain (FALLBACK_CHAIN). For each provider in turn:
 *   • skip it if its key is cooling or dead (keyManager.ts),
 *   • take a DB key from the admin pool if one exists, else the env var,
 *   • skip it if neither is configured,
 *   • call it; on any failure — HTTP error, retired model, timeout, DNS —
 *     mark the key and MOVE ON to the next provider.
 * Only when every provider has been tried does the call throw, and the error
 * lists every attempt, so an alert reads "[Groq] HTTP 404 model retired ·
 * [Gemini] cooling · …" rather than the last failure alone.
 *
 * In September 2026 the chain went dark because four of its five providers
 * had retired the model or the endpoint (Groq llama-3.1-8b, Gemini 2.0
 * flash-lite, OpenRouter's free llama-3.2, GitHub Models altogether) and the
 * old code aborted the chain on the first non-transient error. The NVIDIA
 * NIM keys had been defined but were in no chain at all. Model ids here are
 * checked by lib/__tests__/ai-providers.test.ts against a list of known
 * retirements; when a provider retires a model, change it here and in that
 * list.
 *
 * ─── COST TRACKING ───────────────────────────────────────────────────────────
 * centsPerMToken: estimated USD cents per million tokens (input+output).
 * NVIDIA NIM, Groq, OpenRouter (free models) and Gemini = 0 (free tier).
 * Cerebras / Mistral paid tiers carry a small estimate.
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

export interface ProviderDef {
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

/** Per-provider request timeout. Dead hosts and retired models fail in well
 *  under a second; this only bounds a provider that accepts and then stalls.
 *  Nine providers × 20 s still fits the 55 s the run route allows only
 *  because cooling keys are skipped without a request. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Reasoning models (gpt-oss, GLM, Kimi) spend output tokens thinking before
 *  they answer. An agent asking for 150 tokens of summary would get an empty
 *  reply, so every request is given at least this much room. */
const MIN_MAX_TOKENS = 600;

// ─── Provider catalogue ───────────────────────────────────────────────────────
// Add new providers here. Set centsPerMToken = 0 for free tiers.

export const PROVIDERS: Record<string, ProviderDef> = {
  // ── NVIDIA NIM (free credits — 5 separate keys, any key serves any model) ──
  kimi: {
    key: "kimi", label: "Kimi K2.6", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_KIMI_KEY", model: "moonshotai/kimi-k2.6",
    maxTokens: 4096, centsPerMToken: 0,
  },
  deepseek: {
    key: "deepseek", label: "DeepSeek V4 Flash", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_DEEPSEEK_KEY", model: "deepseek-ai/deepseek-v4-flash-0731",
    maxTokens: 4096, centsPerMToken: 0,
  },
  glm: {
    key: "glm", label: "GLM 5.3 Flash", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_GLM_KEY", model: "z-ai/glm-5.3-flash",
    maxTokens: 4096, centsPerMToken: 0,
  },
  // Was MiniMax M3, which NIM no longer lists; the key is the same NVIDIA key.
  lightning: {
    key: "lightning", label: "Nemotron 3.5 Lightning", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MINIMAX_KEY", model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    maxTokens: 4096, centsPerMToken: 0,
  },
  nvidia_mistral: {
    key: "nvidia_mistral", label: "Mistral Nemotron", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MISTRAL_KEY", model: "mistralai/mistral-nemotron",
    maxTokens: 4096, centsPerMToken: 0,
  },
  // Gemma 4 shares NVIDIA_MISTRAL_KEY (both are NVIDIA NIM credits).
  gemma: {
    key: "gemma", label: "Gemma 4 31B", baseURL: NVIDIA_BASE,
    envKey: "NVIDIA_MISTRAL_KEY", model: "google/gemma-4-31b-it",
    maxTokens: 4096, centsPerMToken: 0,
  },

  // ── Free-tier providers ────────────────────────────────────────────────────
  groq: {
    key: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY", model: "openai/gpt-oss-20b",
    maxTokens: 1024, centsPerMToken: 0,
    extraBody: { reasoning_effort: "low" },
  },
  gemini: {
    key: "gemini", label: "Gemini Flash", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GOOGLE_AI_KEY", model: "gemini-2.5-flash-lite",
    maxTokens: 1024, centsPerMToken: 0,
  },
  openrouter: {
    key: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY", model: "google/gemma-4-31b-it:free",
    maxTokens: 1024, centsPerMToken: 0,
    extraHeaders: {
      "HTTP-Referer": "https://www.elitebcn.info",
      "X-Title":      "Elite BCN Transfers",
    },
  },

  // ── Paid last resorts ──────────────────────────────────────────────────────
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
  opencode: {
    key: "opencode", label: "OpenCode", baseURL: "https://api.openai.com/v1",
    envKey: "OPENCODE_API_KEY", model: "gpt-4o-mini",
    maxTokens: 1024, centsPerMToken: 20,
  },
};

// ─── Primary provider per agent ───────────────────────────────────────────────
// "Primary" = first provider tried. Display only — actual routing from FALLBACK_CHAIN.
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
// Free tiers first (Groq, Gemini, then the NVIDIA NIM keys, then OpenRouter's
// free model); the paid Mistral key is the last resort. DB keys from the
// admin pool are preferred over env vars for every provider.
const FREE_CHAIN  = ["groq", "gemini", "kimi", "gemma", "glm", "deepseek", "lightning", "nvidia_mistral", "openrouter", "mistral"];
const FALLBACK_CHAIN: Record<string, string[]> = {
  health:       FREE_CHAIN,
  seo:          FREE_CHAIN,
  analytics:    FREE_CHAIN,
  orchestrator: FREE_CHAIN,
  support:      FREE_CHAIN,
  booking:      FREE_CHAIN,
  knowledge:    FREE_CHAIN,
  marketing:    ["gemini", ...FREE_CHAIN.filter((k) => k !== "gemini")],
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** The chain for an agent, minus providers whose key is dead. A provider with
 *  no env var stays in: the admin pool may hold a key for it. */
function resolveChain(agentName: string): ProviderDef[] {
  const chain = FALLBACK_CHAIN[agentName] ?? FREE_CHAIN;
  return chain
    .map((k) => PROVIDERS[k])
    .filter((p): p is ProviderDef => Boolean(p) && getKeyStatus(p.envKey, p.label) !== "dead");
}

interface Credential { rawKey: string; dbKeyId: string | null }

/** A DB pool key for this provider if the admin added one, else the env var. */
async function credentialFor(p: ProviderDef, agentName: string): Promise<Credential | null> {
  const dbEntry = await pickKey(p.key, agentName).catch(() => null);
  if (dbEntry) return { rawKey: dbEntry.rawKey, dbKeyId: dbEntry.id };
  const rawKey = process.env[p.envKey] ?? "";
  return rawKey ? { rawKey, dbKeyId: null } : null;
}

async function recordFailure(p: ProviderDef, cred: Credential, reason: string): Promise<void> {
  if (cred.dbKeyId) await markDbKeyFailed(cred.dbKeyId, reason).catch(() => {});
  else markFailed(p.envKey, reason, p.label);
}

async function recordSuccess(p: ProviderDef, cred: Credential, latencyMs: number): Promise<void> {
  if (cred.dbKeyId) await markDbKeySuccess(cred.dbKeyId).catch(() => {});
  else markSuccess(p.envKey, latencyMs, p.label);
}

function buildHeaders(p: ProviderDef, key: string): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${key}`,
    ...(p.extraHeaders ?? {}),
  };
}

function buildBody(p: ProviderDef, messages: ProviderMessage[], maxTokens: number | undefined, temperature: number, stream: boolean) {
  return JSON.stringify({
    model:       p.model,
    messages,
    max_tokens:  Math.max(maxTokens ?? p.maxTokens, MIN_MAX_TOKENS),
    temperature,
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    ...(p.extraBody ?? {}),
  });
}

/** One line describing why a request failed, with the network cause when
 *  undici only says "fetch failed" (ENOTFOUND, ECONNRESET, certificate…). */
function describeError(err: unknown, latencyMs: number): string {
  if ((err as Error)?.name === "TimeoutError") return `timeout after ${latencyMs}ms`;
  const e = err as { message?: string; cause?: { code?: string; message?: string } };
  const cause = e?.cause?.code ?? e?.cause?.message;
  return cause ? `${e.message} (${cause})` : (e?.message ?? String(err));
}

function chainError(agentName: string, attempts: string[]): Error {
  if (!attempts.length) return new Error(`No providers configured for agent: ${agentName}`);
  return new Error(`All providers failed for ${agentName}: ${attempts.join(" · ")}`);
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
  const attempts: string[] = [];

  for (const p of resolveChain(agentName)) {
    if (getKeyStatus(p.envKey, p.label) === "cooling") { attempts.push(`[${p.label}] cooling`); continue; }
    const cred = await credentialFor(p, agentName);
    if (!cred) continue;

    const t0 = Date.now();
    try {
      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, cred.rawKey),
        body:    buildBody(p, messages, opts?.maxTokens, opts?.temperature ?? 0.3, false),
        signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const latency = Date.now() - t0;

      if (!res.ok) {
        const body   = await res.text().catch(() => "");
        const reason = `HTTP ${res.status}: ${body.slice(0, 150)}`;
        await recordFailure(p, cred, reason);
        attempts.push(`[${p.label}] ${reason.slice(0, 120)}`);
        continue;
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?:   { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text.trim()) {
        // A reasoning model that spent its whole budget thinking, or a
        // provider that returned 200 with nothing in it. Try the next one.
        await recordFailure(p, cred, "empty response");
        attempts.push(`[${p.label}] empty response`);
        continue;
      }

      const inputTokens  = data.usage?.prompt_tokens     ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      await recordSuccess(p, cred, latency);
      return { text, inputTokens, outputTokens, costCents: computeCost(p, inputTokens, outputTokens), provider: p.label, model: p.model, latencyMs: latency };

    } catch (err) {
      const reason = describeError(err, Date.now() - t0);
      await recordFailure(p, cred, reason);
      attempts.push(`[${p.label}] ${reason.slice(0, 120)}`);
    }
  }

  throw chainError(agentName, attempts);
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
  const attempts: string[] = [];

  for (const p of resolveChain(agentName)) {
    if (getKeyStatus(p.envKey, p.label) === "cooling") { attempts.push(`[${p.label}] cooling`); continue; }
    const cred = await credentialFor(p, agentName);
    if (!cred) continue;

    const t0 = Date.now();
    let yielded = false;
    try {
      const res = await fetch(`${p.baseURL}/chat/completions`, {
        method:  "POST",
        headers: buildHeaders(p, cred.rawKey),
        body:    buildBody(p, messages, opts?.maxTokens, 0.3, true),
        signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const body   = await res.text().catch(() => "");
        const reason = `HTTP ${res.status}: ${body.slice(0, 150)}`;
        await recordFailure(p, cred, reason);
        attempts.push(`[${p.label}] ${reason.slice(0, 120)}`);
        continue;
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
              if (delta) { yielded = true; yield { type: "text", text: delta }; }
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

      const latency = Date.now() - t0;
      await recordSuccess(p, cred, latency);
      yield { type: "done", inputTokens, outputTokens, costCents: computeCost(p, inputTokens, outputTokens), provider: p.label, model: p.model, latencyMs: latency };
      return;

    } catch (err) {
      const reason = describeError(err, Date.now() - t0);
      await recordFailure(p, cred, reason);
      attempts.push(`[${p.label}] ${reason.slice(0, 120)}`);
      // Once the reader has seen part of an answer, a second provider would
      // start the answer again underneath it. Stop here instead.
      if (yielded) throw chainError(agentName, attempts);
    }
  }

  throw chainError(agentName, attempts);
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
