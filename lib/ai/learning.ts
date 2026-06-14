/**
 * Agent learning system.
 *
 * Agents call runDailyReview() once per day. It:
 *  1. Reads recent AiLog entries for the agent
 *  2. Reads recent ConversationLog entries (support agent only)
 *  3. Asks the AI to identify patterns and propose improvements
 *  4. Saves OBSERVATION memories to AiMemory
 *  5. Submits concrete proposals as ApprovalItem for admin review
 *
 * Admins approve/reject at /admin/hq/learning.
 * No change is applied automatically — approval gates everything.
 */

import { prisma } from "@/lib/prisma";
import { callProvider } from "@/lib/ai/providers";

const MAX_LOGS     = 50;
const MAX_CONVOS   = 20;
const REVIEW_HOURS = 24;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runDailyReview(agentName: string): Promise<void> {
  const agent = await prisma.aiAgent.findUnique({ where: { name: agentName } });
  if (!agent || !agent.isEnabled) return;

  const since = new Date(Date.now() - REVIEW_HOURS * 60 * 60 * 1000);

  // Gather evidence
  const [logs, convos] = await Promise.all([
    prisma.aiLog.findMany({
      where:   { agentId: agent.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take:    MAX_LOGS,
      select:  { action: true, message: true, tokensUsed: true, costCents: true, createdAt: true },
    }),
    agentName === "support"
      ? prisma.conversationLog.findMany({
          where:   { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take:    MAX_CONVOS,
          select:  { messages: true, language: true, escalated: true },
        })
      : Promise.resolve([] as { messages: unknown; language: string; escalated: boolean }[]),
  ]);

  if (!logs.length && !convos.length) return;

  // Build review input
  const logSummary = logs
    .map((l) => `[${l.action}] ${l.message} (${l.tokensUsed ?? 0} tokens)`)
    .join("\n");

  const convoSummary = convos
    .map((c, i) => {
      const msgs = Array.isArray(c.messages)
        ? (c.messages as { role: string; content: string }[])
            .filter((m) => m.role === "user")
            .slice(-3)
            .map((m) => `  user: ${String(m.content).slice(0, 120)}`)
            .join("\n")
        : "";
      return `Conv ${i + 1} (lang=${c.language}, escalated=${c.escalated}):\n${msgs}`;
    })
    .join("\n---\n");

  const reviewPrompt = `You are reviewing the last 24 hours of logs for the "${agentName}" AI agent on elitebcn.info (luxury chauffeur service in Barcelona).

AGENT LOGS:
${logSummary || "No logs."}

${convoSummary ? `CUSTOMER CONVERSATIONS (last ${MAX_CONVOS}):\n${convoSummary}` : ""}

Identify:
1. Recurring customer questions or pain points
2. Failure patterns (errors, escalations, timeouts)
3. ONE concrete improvement proposal (be specific: what to add/change)

Respond in this JSON format:
{
  "observations": ["observation 1", "observation 2"],
  "improvement": {
    "title": "Short title",
    "description": "Specific change to make, and why it will help",
    "impact": "high|medium|low"
  }
}`;

  let result: string;
  try {
    const { text } = await callProvider("orchestrator", [
      { role: "system", content: "You are a concise AI system reviewer. Reply with valid JSON only." },
      { role: "user", content: reviewPrompt },
    ], { maxTokens: 512, temperature: 0.2 });
    result = text;
  } catch {
    return;
  }

  // Parse response
  let parsed: { observations?: string[]; improvement?: { title: string; description: string; impact: string } };
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return;
  }

  // Save observations as AiMemory
  const observations = parsed.observations ?? [];
  for (const obs of observations.slice(0, 5)) {
    if (!obs?.trim()) continue;
    await prisma.aiMemory.create({
      data: {
        agentId:    agent.id,
        type:       "OBSERVATION",
        title:      `[${agentName}] ${obs.slice(0, 80)}`,
        content:    obs,
        tags:       [agentName, "daily-review"],
        importance: 3,
        expiresAt:  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    }).catch(() => {});
  }

  // Submit improvement as ApprovalItem
  const imp = parsed.improvement;
  if (imp?.title && imp?.description) {
    await prisma.approvalItem.create({
      data: {
        agentId:  agent.id,
        type:     "IMPROVEMENT",
        title:    imp.title,
        preview:  imp.description,
        diffBefore: "Current behaviour",
        diffAfter:  imp.description,
        metadata: {
          agentName,
          impact:       imp.impact ?? "medium",
          observations,
          reviewPeriod: since.toISOString(),
        },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }
}

// ─── Trigger learning for all active agents ───────────────────────────────────

export async function runAllAgentReviews(): Promise<void> {
  const agents = await prisma.aiAgent.findMany({ where: { isEnabled: true }, select: { name: true } });
  for (const a of agents) {
    await runDailyReview(a.name).catch(() => {});
  }
}

// ─── Fetch learning data for the dashboard ────────────────────────────────────

export async function getLearningDashboardData() {
  const [pending, recentObservations, recentFlags] = await Promise.all([
    prisma.approvalItem.findMany({
      where:   { status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take:    50,
    }),
    prisma.aiMemory.findMany({
      where:   { type: "OBSERVATION" },
      orderBy: { createdAt: "desc" },
      take:    20,
    }),
    prisma.approvalItem.findMany({
      where:   { type: "PRICE_FLAG", status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take:    10,
    }),
  ]);

  return { pending, recentObservations, recentFlags };
}
