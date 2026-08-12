/**
 * Knowledge Agent — mines conversation logs to grow the knowledge base.
 *
 * Each run:
 *  1. Reads ConversationLog entries from the last 7 days
 *  2. Extracts unanswered questions, escalations, and repeated topics
 *  3. Checks if each topic is already covered in KnowledgeBase
 *  4. For NEW topics → creates an ApprovalItem (type: "KB_PROPOSAL")
 *  5. For OUTDATED entries → proposes updates via ApprovalItem (type: "KB_UPDATE")
 *  6. Writes a FINDING memory with the pattern analysis
 *
 * Admin approves proposals at /admin/hq/learning.
 * Approved KB_PROPOSAL → admin creates the KB entry manually (or future auto-create).
 * Approved KB_UPDATE   → admin edits the existing entry.
 */

import { prisma } from "@/lib/prisma";
import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { log } from "@/lib/ai/logger";

const MAX_CONVOS    = 30;  // conversations to analyse per run
const MAX_PROPOSALS = 5;   // max new KB proposals per run (avoid queue spam)

interface KbProposal {
  category:    string;
  question:    string;
  suggestedAnswer: string;
  sourceCount: number;  // how many convos surfaced this topic
}

export class KnowledgeAgent extends BaseAgent {
  readonly name        = "knowledge";
  readonly description = "Knowledge Manager — mines support chats to keep the knowledge base accurate and complete.";

  async execute(): Promise<void> {
    await log({ agentId: this.agentId, taskId: this.taskId, action: "knowledge_start", message: "Reading recent conversations" });

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── 1. Gather recent conversations ──────────────────────────────────────
    const [convos, existingKb, pendingProposals] = await Promise.all([
      prisma.conversationLog.findMany({
        where:   { createdAt: { gte: since7d } },
        orderBy: { createdAt: "desc" },
        take:    MAX_CONVOS,
        select:  { messages: true, language: true, escalated: true, createdAt: true },
      }),
      prisma.knowledgeBase.findMany({
        where:   { isActive: true },
        select:  { question: true, category: true },
      }),
      // Skip if we already proposed many things this week
      prisma.approvalItem.count({
        where: { type: { in: ["KB_PROPOSAL", "KB_UPDATE"] }, createdAt: { gte: since7d } },
      }),
    ]);

    if (!convos.length) {
      this.taskOutput = { analysed: 0, reason: "No conversations in the last 7 days" };
      await log({ agentId: this.agentId, taskId: this.taskId, action: "knowledge_skip", message: "No conversations to analyse" });
      return;
    }

    if (pendingProposals >= MAX_PROPOSALS) {
      this.taskOutput = { skipped: true, reason: `${pendingProposals} proposals already pending review` };
      await log({ agentId: this.agentId, taskId: this.taskId, action: "knowledge_skip", message: `${pendingProposals} unreviewed proposals — skipping to avoid queue spam` });
      return;
    }

    // ── 2. Summarise conversation content for AI analysis ───────────────────
    const conversationSummary = convos.map((c, i) => {
      const msgs = Array.isArray(c.messages)
        ? (c.messages as { role: string; content: string }[])
            .filter((m) => m.role === "user")
            .slice(0, 4)
            .map((m) => `  Q: ${String(m.content).slice(0, 200)}`)
            .join("\n")
        : "";
      return `Conv ${i + 1} [${c.language}${c.escalated ? " ESCALATED" : ""}]:\n${msgs}`;
    }).join("\n---\n");

    const existingTopics = existingKb.map((e) => `[${e.category}] ${e.question}`).join("\n");

    await log({ agentId: this.agentId, taskId: this.taskId, action: "knowledge_analyse", message: `Analysing ${convos.length} conversations` });

    // ── 3. AI identifies gaps and patterns ───────────────────────────────────
    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "knowledge",
      [
        {
          role:    "system",
          content: `You are the Knowledge Manager for Elite BCN Transfers, a luxury Barcelona chauffeur service.
Analyse customer conversations and identify:
1. Questions that appear multiple times or were escalated (not already covered in the KB)
2. Topics that are in the KB but seem to be outdated or mismatched

Return ONLY a JSON object. Do NOT invent prices or policies — mark those as "NEEDS_ADMIN_INPUT".

Existing KB topics:
${existingTopics || "None yet."}`,
        },
        {
          role:    "user",
          content: `Recent customer conversations (last 7 days):
${conversationSummary}

Identify knowledge gaps. Return:
{
  "patterns": [
    { "topic": "string", "occurrences": N, "example": "verbatim customer question" }
  ],
  "proposals": [
    {
      "category": "Pricing|Fleet|Booking|Policies|Transfers|FAQ",
      "question": "How do I... / What is...",
      "suggestedAnswer": "Answer text — use NEEDS_ADMIN_INPUT where you can't be certain",
      "sourceCount": N,
      "isNew": true
    }
  ],
  "outdatedTopics": [
    { "existingQuestion": "question from KB", "issue": "why it seems outdated" }
  ]
}`,
        },
      ],
      { maxTokens: 1024, temperature: 0.2 },
    );
    await this.trackSpend(costCents, inputTokens, outputTokens);

    // ── 4. Parse AI response ─────────────────────────────────────────────────
    let analysis: {
      patterns?:       Array<{ topic: string; occurrences: number; example: string }>;
      proposals?:      Array<KbProposal & { isNew?: boolean }>;
      outdatedTopics?: Array<{ existingQuestion: string; issue: string }>;
    } = {};

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
    } catch {
      await log({ agentId: this.agentId, taskId: this.taskId, action: "knowledge_parse_error", level: "warn", message: "Could not parse AI JSON" });
    }

    const proposals     = (analysis.proposals     ?? []).slice(0, MAX_PROPOSALS);
    const outdated      = (analysis.outdatedTopics ?? []).slice(0, 3);
    const expires       = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    let   createdCount  = 0;

    // ── 5. Create KB_PROPOSAL approval items ────────────────────────────────
    for (const p of proposals) {
      if (!p.question?.trim() || !p.suggestedAnswer?.trim()) continue;

      // De-dupe: skip if very similar question already exists in KB
      const similar = existingKb.some((e) =>
        e.question.toLowerCase().includes(p.question.toLowerCase().split(" ").slice(0, 4).join(" ")) ||
        p.question.toLowerCase().includes(e.question.toLowerCase().split(" ").slice(0, 4).join(" ")),
      );
      if (similar) continue;

      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "KB_PROPOSAL",
          title:     `New KB entry: ${p.question.slice(0, 80)}`,
          preview:   `Category: ${p.category}\nQuestion: ${p.question}\n\nSuggested Answer:\n${p.suggestedAnswer}\n\nSeen in ${p.sourceCount ?? 1} conversation(s).`,
          diffBefore: "Not in knowledge base",
          diffAfter:  `[${p.category}] Q: ${p.question}\nA: ${p.suggestedAnswer}`,
          metadata:  { category: p.category, question: p.question, suggestedAnswer: p.suggestedAnswer, sourceCount: p.sourceCount },
          expiresAt: expires,
        },
      });
      createdCount++;
    }

    // ── 6. Create KB_UPDATE items for outdated topics ────────────────────────
    for (const o of outdated) {
      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "KB_UPDATE",
          title:     `KB may be outdated: ${o.existingQuestion.slice(0, 70)}`,
          preview:   `Existing question: "${o.existingQuestion}"\n\nIssue: ${o.issue}`,
          diffBefore: o.existingQuestion,
          diffAfter:  `⚠ Needs review: ${o.issue}`,
          metadata:  { existingQuestion: o.existingQuestion, issue: o.issue },
          expiresAt: expires,
        },
      });
      createdCount++;
    }

    // ── 7. Memory and task output ─────────────────────────────────────────────
    const patterns = analysis.patterns ?? [];
    const topPattern = patterns.sort((a, b) => b.occurrences - a.occurrences)[0];

    const memContent = [
      `📚 Knowledge Analysis — ${new Date().toLocaleDateString("en-GB")}`,
      ``,
      `Conversations analysed: ${convos.length} (last 7 days)`,
      `Escalated: ${convos.filter((c) => c.escalated).length}`,
      ``,
      topPattern ? `Top repeated topic: "${topPattern.topic}" (${topPattern.occurrences}× seen)` : "No clear repeated pattern",
      ``,
      `Proposals created: ${createdCount}`,
      patterns.length ? `\nPatterns:\n${patterns.slice(0, 5).map((p) => `  • ${p.topic}: ${p.occurrences}× — "${p.example.slice(0, 80)}"`).join("\n")}` : "",
    ].join("\n");

    this.taskOutput = { analysed: convos.length, proposalsCreated: createdCount, patterns: patterns.length };

    await saveMemory({
      agentId:    this.agentId,
      type:       "FINDING",
      title:      `KB Analysis — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
      content:    memContent,
      tags:       ["knowledge", "gaps", "patterns"],
      importance: createdCount > 0 ? 4 : 3,
      ttlDays:    30,
    });

    await log({
      agentId: this.agentId,
      taskId:  this.taskId,
      action:  "knowledge_complete",
      message: `Analysed ${convos.length} convos | ${createdCount} proposals created | ${patterns.length} patterns found`,
    });
  }
}
