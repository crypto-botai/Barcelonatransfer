import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { log } from "@/lib/ai/logger";

const BASE_URL = "https://www.elitebcn.info";

const PAGES_TO_AUDIT = [
  "/", "/book", "/pricing", "/fleet", "/airport-transfers",
  "/transfers", "/corporate", "/hourly", "/contact", "/faq",
];

interface PageSeo {
  url:    string;
  title:  string;
  desc:   string;
  h1:     string;
  issues: string[];
}

function auditPage(url: string, html: string): PageSeo {
  const titleM = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  const descM  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["']/i)
                 ?? html.match(/<meta[^>]+content=["']([^"']{1,300})["'][^>]+name=["']description["']/i);
  const h1M    = html.match(/<h1[^>]*>([^<]{1,100})<\/h1>/i);

  const title = titleM?.[1]?.trim() ?? "";
  const desc  = descM?.[1]?.trim()  ?? "";
  const h1    = h1M?.[1]?.trim()    ?? "";

  const issues: string[] = [];
  if (!title)             issues.push("Missing title tag");
  else if (title.length < 20) issues.push(`Title too short (${title.length} chars)`);
  else if (title.length > 70) issues.push(`Title too long (${title.length} chars)`);

  if (!desc)              issues.push("Missing meta description");
  else if (desc.length < 50)  issues.push(`Description too short (${desc.length} chars)`);
  else if (desc.length > 160) issues.push(`Description too long (${desc.length} chars)`);

  if (!h1)                issues.push("Missing H1 tag");

  return { url, title, desc, h1, issues };
}

export class SeoAgent extends BaseAgent {
  readonly name        = "seo";
  readonly description = "SEO monitor — scans pages for metadata quality, title/description, H1 coverage.";

  async execute(): Promise<void> {
    await log({ agentId: this.agentId, taskId: this.taskId, action: "seo_start", message: `Auditing ${PAGES_TO_AUDIT.length} pages` });

    const fetched = await Promise.all(
      PAGES_TO_AUDIT.map(async (page) => {
        try {
          const html = await fetch(`${BASE_URL}${page}`, {
            signal:  AbortSignal.timeout(7000),
            headers: { "User-Agent": "EliteBCN-SeoBot/1.0" },
          }).then((r) => r.text());
          return auditPage(page, html);
        } catch {
          return { url: page, title: "", desc: "", h1: "", issues: ["Page unreachable"] };
        }
      }),
    );

    const totalIssues  = fetched.reduce((s, p) => s + p.issues.length, 0);
    const pagesWithIssues = fetched.filter((p) => p.issues.length > 0);

    this.taskOutput = { pagesAudited: fetched.length, totalIssues, pagesWithIssues: pagesWithIssues.length };

    const prompt = `SEO audit for elitebcn.info (luxury Barcelona chauffeur service):
${pagesWithIssues.map((p) => `  ${p.url}: ${p.issues.join("; ")}`).join("\n") || "  No issues found"}

Total: ${totalIssues} issues across ${PAGES_TO_AUDIT.length} pages.
Provide 3 specific, actionable SEO improvements ranked by priority. Be concise.`;

    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "seo",
      [
        { role: "system", content: "You are an SEO specialist for luxury travel brands. Focus on high-impact recommendations." },
        { role: "user",   content: prompt },
      ],
      { maxTokens: 250 },
    );
    await this.trackSpend(costCents, inputTokens, outputTokens);

    const memContent = [
      `AI Recommendations:\n${text}`,
      ``,
      `Audit Results (${totalIssues} issues across ${fetched.length} pages):`,
      ...fetched.map((p) =>
        `  ${p.issues.length === 0 ? "✓" : "✗"} ${p.url.padEnd(30)} ${p.issues.length === 0 ? "OK" : p.issues.join(", ")}`
      ),
    ].join("\n");

    await saveMemory({
      agentId:    this.agentId,
      type:       "REPORT",
      title:      `SEO Audit — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      content:    memContent,
      tags:       ["seo", "audit", totalIssues > 5 ? "issues" : "ok"],
      importance: totalIssues > 10 ? 5 : totalIssues > 3 ? 4 : 3,
      ttlDays:    14,
    });

    await log({
      agentId: this.agentId,
      taskId:  this.taskId,
      action:  "seo_complete",
      message: `${totalIssues} SEO issues across ${fetched.length} pages | ${pagesWithIssues.length} pages need work`,
    });
  }
}
