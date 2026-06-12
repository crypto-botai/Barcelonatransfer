/**
 * Multi-provider AI client — one API key per agent, all free tiers.
 * All providers use the OpenAI-compatible chat completions format.
 *
 * Agent → Provider mapping:
 *   support      → Groq        (llama-3.1-8b-instant, fastest for live chat)
 *   booking      → Cerebras    (llama3.1-8b, fast JSON analysis)
 *   orchestrator → Mistral     (mistral-small-latest, reliable reasoning)
 *   health       → OpenRouter  (meta-llama/llama-3.2-3b-instruct:free)
 *   seo          → Google      (gemini-2.0-flash-lite)
 *   analytics    → GitHub      (gpt-4o-mini, free with PAT)
 *   fallback     → OpenCode    (used when primary key exhausted)
 */

export type AgentName = "support" | "booking" | "orchestrator" | "health" | "seo" | "analytics";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallResult {
  text:         string;
  inputTokens:  number;
  outputTokens: number;
  costCents:    number; // 0 — free tier
  provider:     string;
  model:        string;
}

interface ProviderDef {
  label:     string;
  baseURL:   string;
  envKey:    string;
  model:     string;
  maxTokens: number;
  extraHeaders?: Record<string, string>;
}

const PROVIDERS: Record<string, ProviderDef> = {
  groq: {
    label:     "Groq",
    baseURL:   "https://api.groq.com/openai/v1",
    envKey:    "GROQ_API_KEY",
    model:     "llama-3.1-8b-instant",
    maxTokens: 1024,
  },
  cerebras: {
    label:     "Cerebras",
    baseURL:   "https://api.cerebras.ai/v1",
    envKey:    "CEREBRAS_API_KEY",
    model:     "llama3.1-8b",
    maxTokens: 1024,
  },
  mistral: {
    label:     "Mistral",
    baseURL:   "https://api.mistral.ai/v1",
    envKey:    "MISTRAL_API_KEY",
    model:     "mistral-small-latest",
    maxTokens: 1024,
  },
  openrouter: {
    label:     "OpenRouter",
    baseURL:   "https://openrouter.ai/api/v1",
    envKey:    "OPENROUTER_API_KEY",
    model:     "meta-llama/llama-3.2-3b-instruct:free",
    maxTokens: 1024,
    extraHeaders: {
      "HTTP-Referer": "https://www.elitebcn.info",
      "X-Title":      "Elite BCN Transfers",
    },
  },
  gemini: {
    label:     "Google Gemini",
    baseURL:   "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey:    "GOOGLE_AI_KEY",
    model:     "gemini-2.0-flash-lite",
    maxTokens: 1024,
  },
  github: {
    label:     "GitHub Models",
    baseURL:   "https://models.inference.ai.azure.com",
    envKey:    "GITHUB_AI_TOKEN",
    model:     "gpt-4o-mini",
    maxTokens: 1024,
  },
  opencode: {
    label:     "OpenCode",
    baseURL:   "https://api.openai.com/v1",
    envKey:    "OPENCODE_API_KEY",
    model:     "gpt-4o-mini",
    maxTokens: 1024,
  },
};

// One provider per agent
export const AGENT_PROVIDER: Record<string, string> = {
  support:      "groq",
  booking:      "cerebras",
  orchestrator: "mistral",
  health:       "openrouter",
  seo:          "gemini",
  analytics:    "github",
};

function resolveProvider(agentName: string): ProviderDef {
  const key = AGENT_PROVIDER[agentName] ?? "groq";
  return PROVIDERS[key] ?? PROVIDERS.groq;
}

function getApiKey(p: ProviderDef): string {
  const key = process.env[p.envKey] ?? "";
  if (!key) throw new Error(`Missing env var ${p.envKey} for ${p.label}`);
  return key;
}

function buildHeaders(p: ProviderDef, apiKey: string): Record<string, string> {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${apiKey}`,
    ...(p.extraHeaders ?? {}),
  };
}

// ─── Non-streaming call ────────────────────────────────────────────────────
export async function callProvider(
  agentName: string,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number; temperature?: number },
): Promise<CallResult> {
  const p      = resolveProvider(agentName);
  const apiKey = getApiKey(p);

  const res = await fetch(`${p.baseURL}/chat/completions`, {
    method:  "POST",
    headers: buildHeaders(p, apiKey),
    body: JSON.stringify({
      model:       p.model,
      messages,
      max_tokens:  opts?.maxTokens ?? p.maxTokens,
      temperature: opts?.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Detect quota/rate-limit errors for the dashboard
    const isQuota = res.status === 429 || body.includes("quota") || body.includes("rate_limit");
    throw Object.assign(new Error(`[${p.label}] ${res.status}: ${body.slice(0, 300)}`), { isQuota, provider: p.label });
  }

  const data = await res.json();
  return {
    text:         data.choices?.[0]?.message?.content ?? "",
    inputTokens:  data.usage?.prompt_tokens    ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    costCents:    0,
    provider:     p.label,
    model:        p.model,
  };
}

// ─── Streaming call ────────────────────────────────────────────────────────
export async function* streamProvider(
  agentName: string,
  messages: ProviderMessage[],
  opts?: { maxTokens?: number },
): AsyncGenerator<
  | { type: "text"; text: string }
  | { type: "done"; inputTokens: number; outputTokens: number; costCents: number; provider: string; model: string }
> {
  const p      = resolveProvider(agentName);
  const apiKey = getApiKey(p);

  const res = await fetch(`${p.baseURL}/chat/completions`, {
    method:  "POST",
    headers: buildHeaders(p, apiKey),
    body: JSON.stringify({
      model:          p.model,
      messages,
      max_tokens:     opts?.maxTokens ?? p.maxTokens,
      temperature:    0.3,
      stream:         true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const isQuota = res.status === 429 || body.includes("quota") || body.includes("rate_limit");
    throw Object.assign(new Error(`[${p.label}] ${res.status}: ${body.slice(0, 300)}`), { isQuota, provider: p.label });
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer       = "";
  let inputTokens  = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const raw = trimmed.slice(6);
        if (raw === "[DONE]") continue;

        try {
          const chunk  = JSON.parse(raw);
          const delta  = chunk.choices?.[0]?.delta?.content;
          if (delta) yield { type: "text", text: delta };
          if (chunk.usage) {
            inputTokens  = chunk.usage.prompt_tokens    ?? inputTokens;
            outputTokens = chunk.usage.completion_tokens ?? outputTokens;
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: "done", inputTokens, outputTokens, costCents: 0, provider: p.label, model: p.model };
}

// ─── Usage summary for admin (when quota exhausted) ───────────────────────
export function getProviderInfo(): { agent: string; provider: string; model: string; envKey: string }[] {
  return Object.entries(AGENT_PROVIDER).map(([agent, provKey]) => {
    const p = PROVIDERS[provKey];
    return { agent, provider: p.label, model: p.model, envKey: p.envKey };
  });
}
