import { prisma } from "@/lib/prisma";
import { callClaude, streamClaude } from "@/lib/ai/claude";
import { recordSpend } from "@/lib/ai/budget";
import { log } from "@/lib/ai/logger";
import { sanitize, wrapAsData } from "@/lib/ai/guardrails";
import { buildSupportSystemPrompt } from "@/lib/ai/prompts/support";

const AGENT_NAME = "support";

// Fetch active KB entries and format them as a text block for the system prompt
async function buildKbText(language: string): Promise<string> {
  const entries = await prisma.knowledgeBase.findMany({
    where: { isActive: true, OR: [{ language }, { language: "en" }] },
    orderBy: [{ category: "asc" }, { usageCount: "desc" }],
    take: 60,
  });

  if (!entries.length) return "No knowledge base entries found.";

  const grouped: Record<string, typeof entries> = {};
  for (const e of entries) {
    (grouped[e.category] ??= []).push(e);
  }

  return Object.entries(grouped)
    .map(([cat, items]) => {
      const lines = items.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n");
      return `## ${cat.toUpperCase()}\n${lines}`;
    })
    .join("\n\n---\n\n");
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Non-streaming: full response
export async function getSupportReply(
  sessionId: string,
  messages: ChatMessage[],
  language = "en",
): Promise<{ reply: string; escalate: boolean }> {
  const agentRecord = await prisma.aiAgent.findUnique({ where: { name: AGENT_NAME } });

  const kbText    = await buildKbText(language);
  const systemPrompt = buildSupportSystemPrompt(kbText, language);

  // Sanitise customer messages
  const sanitisedMessages = messages.map((m) =>
    m.role === "user"
      ? { role: m.role, content: wrapAsData("customer_message", m.content) }
      : m,
  );

  const { text, inputTokens, outputTokens, costCents } = await callClaude({
    model: "haiku",
    system: systemPrompt,
    messages: sanitisedMessages,
    maxTokens: 512,
  });

  if (agentRecord) {
    await recordSpend(costCents, agentRecord.id);
    await log({
      agentId:    agentRecord.id,
      action:     "chat_reply",
      message:    `Session ${sessionId}: ${inputTokens}in/${outputTokens}out`,
      tokensUsed: inputTokens + outputTokens,
      costCents,
    });
  }

  // Update KB usage counts
  await updateKbUsage(messages[messages.length - 1]?.content ?? "");

  const escalate = /connect you with|our team|whatsapp|vtcbcn2025/i.test(text);

  return { reply: text, escalate };
}

// Streaming version — yields SSE chunks
export async function* streamSupportReply(
  sessionId: string,
  messages: ChatMessage[],
  language = "en",
): AsyncGenerator<{ type: "text"; text: string } | { type: "done"; escalate: boolean }> {
  const agentRecord = await prisma.aiAgent.findUnique({ where: { name: AGENT_NAME } });

  const kbText      = await buildKbText(language);
  const systemPrompt = buildSupportSystemPrompt(kbText, language);

  const sanitisedMessages = messages.map((m) =>
    m.role === "user"
      ? { role: m.role, content: wrapAsData("customer_message", m.content) }
      : m,
  );

  let fullText = "";

  for await (const chunk of streamClaude({ model: "haiku", system: systemPrompt, messages: sanitisedMessages, maxTokens: 512 })) {
    if (chunk.type === "text") {
      fullText += chunk.text;
      yield { type: "text", text: chunk.text };
    } else {
      // done chunk
      if (agentRecord) {
        await recordSpend(chunk.costCents, agentRecord.id);
        await log({
          agentId:    agentRecord.id,
          action:     "chat_stream",
          message:    `Session ${sessionId}`,
          tokensUsed: chunk.inputTokens + chunk.outputTokens,
          costCents:  chunk.costCents,
        });
      }
      const escalate = /connect you with|our team|whatsapp|vtcbcn2025/i.test(fullText);
      yield { type: "done", escalate };
    }
  }
}

async function updateKbUsage(userMessage: string): Promise<void> {
  const words = sanitize(userMessage).toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return;

  const entries = await prisma.knowledgeBase.findMany({
    where: {
      OR: words.map((w) => ({ question: { contains: w, mode: "insensitive" as const } })),
      isActive: true,
    },
    take: 3,
    select: { id: true },
  });

  for (const e of entries) {
    await prisma.knowledgeBase
      .update({ where: { id: e.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } })
      .catch(() => {});
  }
}
