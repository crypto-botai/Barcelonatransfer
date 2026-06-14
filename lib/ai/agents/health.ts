import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { createAlert, dayDedupeKey } from "@/lib/ai/alerts";
import { log } from "@/lib/ai/logger";

const BASE_URL = "https://www.elitebcn.info";

const PAGES = [
  "/", "/book", "/pricing", "/fleet", "/airport-transfers",
  "/transfers", "/corporate", "/hourly", "/contact", "/faq",
  "/transfers/sitges", "/transfers/andorra", "/sitemap.xml",
];

type PageResult = { url: string; status: number; ms: number; ok: boolean; error?: string };

export class HealthAgent extends BaseAgent {
  readonly name        = "health";
  readonly description = "Website health monitor — checks all key pages for uptime and response time.";

  async execute(): Promise<void> {
    await log({ agentId: this.agentId, taskId: this.taskId, action: "health_start", message: `Checking ${PAGES.length} pages concurrently` });

    const results: PageResult[] = await Promise.all(
      PAGES.map(async (page) => {
        const t0 = Date.now();
        try {
          const r = await fetch(`${BASE_URL}${page}`, {
            signal: AbortSignal.timeout(6000),
            headers: { "User-Agent": "EliteBCN-HealthBot/1.0" },
          });
          return { url: page, status: r.status, ms: Date.now() - t0, ok: r.ok };
        } catch (e) {
          return { url: page, status: 0, ms: Date.now() - t0, ok: false, error: String(e).slice(0, 80) };
        }
      }),
    );

    const failing  = results.filter((r) => !r.ok);
    const slow     = results.filter((r) => r.ms > 3000 && r.ok);
    const avgMs    = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
    const upPct    = Math.round(((results.length - failing.length) / results.length) * 100);

    this.taskOutput = { pagesChecked: results.length, failing: failing.length, slow: slow.length, avgMs, upPct };

    // AI summary of findings
    const prompt = `Website health check for elitebcn.info:
- ${results.length} pages checked, ${failing.length} failing, ${slow.length} slow (>3s)
- Uptime: ${upPct}%, avg response: ${avgMs}ms
- Failing: ${failing.map((f) => `${f.url} (HTTP ${f.status || "timeout"})`).join(", ") || "none"}
- Slow: ${slow.map((s) => `${s.url} (${s.ms}ms)`).join(", ") || "none"}

Write a 2-sentence health summary for the admin dashboard. Be specific about issues.`;

    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "health",
      [
        { role: "system", content: "You are a website reliability engineer. Be concise and direct." },
        { role: "user",   content: prompt },
      ],
      { maxTokens: 150 },
    );
    await this.trackSpend(costCents, inputTokens, outputTokens);

    // Store in agent memory
    const memContent = [
      `Summary: ${text}`,
      ``,
      `Uptime: ${upPct}% | Avg: ${avgMs}ms | Checked: ${results.length} pages`,
      ``,
      `Page Results:`,
      ...results.map((r) => `  ${r.ok ? "✓" : "✗"} ${r.url.padEnd(35)} HTTP ${r.status || "ERR"} — ${r.ms}ms${r.error ? ` (${r.error})` : ""}`),
    ].join("\n");

    await saveMemory({
      agentId:    this.agentId,
      type:       "REPORT",
      title:      `Health Check — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      content:    memContent,
      tags:       ["health", "uptime", failing.length > 0 ? "issues" : "ok"],
      importance: failing.length > 2 ? 5 : failing.length > 0 ? 4 : 3,
      ttlDays:    7,
    });

    // Alert if pages are down
    if (failing.length > 0) {
      await createAlert({
        agentId:   this.agentId,
        severity:  failing.length >= 3 ? "CRITICAL" : "WARNING",
        title:     `Health: ${failing.length} page${failing.length > 1 ? "s" : ""} failing`,
        message:   failing.map((f) => `${f.url}: HTTP ${f.status || "timeout"}`).join(", "),
        dedupeKey: dayDedupeKey(`health_fail_${failing.length}`),
        sendEmail: failing.length >= 3,
      });
    }

    await log({
      agentId:    this.agentId,
      taskId:     this.taskId,
      action:     "health_complete",
      message:    `${upPct}% uptime | ${avgMs}ms avg | ${failing.length} failing | ${slow.length} slow`,
      durationMs: avgMs,
    });
  }
}
