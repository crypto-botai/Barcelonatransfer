import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The AI HQ provider chain. In September 2026 every agent failed for days
 * because the models and endpoints in the chain had been retired one by one
 * and the code stopped at the first non-transient error. These guards keep
 * retired ids out and keep the chain walking.
 */
const ROOT = process.cwd();
const SRC  = readFileSync(join(ROOT, "lib", "ai", "providers.ts"), "utf-8");

/** Model ids and hosts known to be gone. Add to this list when a provider
 *  announces a retirement; the test then points at every file still using it. */
const RETIRED = [
  "llama-3.1-8b-instant",              // Groq, shut down 16 Aug 2026
  "llama-3.3-70b-versatile",           // Groq, shut down 16 Aug 2026
  "gemini-2.0-flash-lite",             // Google, shut down 1 Jun 2026
  "gemini-2.0-flash",                  // Google, shut down 1 Jun 2026
  "meta-llama/llama-3.2-3b-instruct",  // OpenRouter, no longer listed
  "models.inference.ai.azure.com",     // GitHub Models, host gone
  "models.github.ai",                  // GitHub Models, retired
  "deepseek-ai/deepseek-v4-pro",       // NVIDIA NIM, no longer listed
  "z-ai/glm-5.1",                      // NVIDIA NIM, no longer listed
  "minimaxai/minimax-m3",              // NVIDIA NIM, no longer listed
  "mistralai/mistral-medium-3.5-128b", // NVIDIA NIM, no longer listed
];

const FILES_WITH_MODEL_IDS = [
  "lib/ai/providers.ts",
  "lib/ai/dbKeyManager.ts",
  "app/admin/ai/cost/page.tsx",
];

describe("AI provider chain", () => {
  it("uses no model or host that has been retired", () => {
    for (const f of FILES_WITH_MODEL_IDS) {
      const s = readFileSync(join(ROOT, f), "utf-8");
      for (const id of RETIRED) {
        expect(s, `${f} still references retired ${id}`).not.toContain(`"${id}"`);
        if (id.includes(".")) expect(s, `${f} still references ${id}`).not.toContain(id + "/");
      }
    }
  });

  it("every provider in a chain exists in the catalogue", () => {
    const catalogue = [...SRC.matchAll(/^  (\w+): \{\r?\n    key: "(\w+)"/gm)].map((m) => m[1]);
    expect(catalogue.length).toBeGreaterThan(5);
    const chain = SRC.match(/const FREE_CHAIN\s*=\s*\[([^\]]+)\]/)![1].match(/"(\w+)"/g)!.map((s) => s.replace(/"/g, ""));
    for (const k of chain) expect(catalogue, `${k} is in the chain but not the catalogue`).toContain(k);
  });

  it("puts the NVIDIA keys in the chain", () => {
    const chain = SRC.match(/const FREE_CHAIN\s*=\s*\[([^\]]+)\]/)![1];
    for (const k of ["kimi", "gemma", "glm"]) expect(chain).toContain(`"${k}"`);
  });

  it("keeps walking the chain after a non-transient error", () => {
    // The old code threw on anything that was not a 429/5xx, so a single
    // retired model ended the whole chain.
    expect(SRC).not.toContain("if (isTransient) continue;");
    expect(SRC).not.toMatch(/if \(isTransient\)/);
    expect(SRC).toContain("throw chainError(agentName, attempts);");
  });

  it("reports every attempt, with the network cause, when all providers fail", () => {
    expect(SRC).toContain("All providers failed for ${agentName}");
    expect(SRC).toMatch(/cause\?\.code/);
  });

  it("does not require an env var for a provider the admin pool may hold a key for", () => {
    expect(SRC).not.toMatch(/if \(!process\.env\[p\.envKey\]\) return false/);
  });

  it("gives reasoning models room to answer", () => {
    expect(SRC).toMatch(/Math\.max\(maxTokens \?\? p\.maxTokens, MIN_MAX_TOKENS\)/);
    expect(SRC).toContain("empty response");
  });

  it("tests admin keys with the same model the agents use", () => {
    const db = readFileSync(join(ROOT, "lib", "ai", "dbKeyManager.ts"), "utf-8");
    expect(db).toContain('await import("@/lib/ai/providers")');
    expect(db).not.toContain("TEST_CONFIGS");
  });

  it("shows the same models on the cost page as the chain uses", () => {
    const cost = readFileSync(join(ROOT, "app", "admin", "ai", "cost", "page.tsx"), "utf-8");
    const groq   = SRC.match(/envKey: "GROQ_API_KEY", model: "([^"]+)"/)![1];
    const gemini = SRC.match(/envKey: "GOOGLE_AI_KEY", model: "([^"]+)"/)![1];
    expect(cost).toContain(`"${groq}"`);
    expect(cost).toContain(`"${gemini}"`);
  });
});
