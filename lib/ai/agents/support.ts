import { prisma } from "@/lib/prisma";
import { callProvider, streamProvider } from "@/lib/ai/providers";
import { recordSpend } from "@/lib/ai/budget";
import { log } from "@/lib/ai/logger";
import { sanitize, wrapAsData } from "@/lib/ai/guardrails";
import { buildSupportSystemPrompt } from "@/lib/ai/prompts/support";

const AGENT_NAME = "support";

async function buildKbText(language: string): Promise<string> {
  const entries = await prisma.knowledgeBase.findMany({
    where: { isActive: true, OR: [{ language }, { language: "en" }] },
    orderBy: [{ category: "asc" }, { usageCount: "desc" }],
    take: 60,
  });

  if (!entries.length) return "No knowledge base entries found.";

  const grouped: Record<string, typeof entries> = {};
  for (const e of entries) (grouped[e.category] ??= []).push(e);

  return Object.entries(grouped)
    .map(([cat, items]) => `## ${cat.toUpperCase()}\n${items.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n")}`)
    .join("\n\n---\n\n");
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getSupportReply(
  sessionId: string,
  messages: ChatMessage[],
  language = "en",
): Promise<{ reply: string; escalate: boolean }> {
  const agentRecord  = await prisma.aiAgent.findUnique({ where: { name: AGENT_NAME } });
  const kbText       = await buildKbText(language);
  const systemPrompt = buildSupportSystemPrompt(kbText, language);

  const sanitisedMessages: { role: "user" | "assistant"; content: string }[] = messages.map((m) =>
    m.role === "user" ? { role: "user" as const, content: wrapAsData("customer_message", m.content) } : { role: "assistant" as const, content: m.content },
  );

  const { text, inputTokens, outputTokens, costCents } = await callProvider(
    AGENT_NAME,
    [{ role: "system", content: systemPrompt }, ...sanitisedMessages],
    { maxTokens: 512 },
  );

  if (agentRecord) {
    await recordSpend(costCents, agentRecord.id);
    await log({ agentId: agentRecord.id, action: "chat_reply", message: `Session ${sessionId}: ${inputTokens}in/${outputTokens}out`, tokensUsed: inputTokens + outputTokens, costCents });
  }

  await updateKbUsage(messages[messages.length - 1]?.content ?? "");
  const escalate = /connect you with|our team|whatsapp|vtcbcn2025/i.test(text);
  return { reply: text, escalate };
}

export async function* streamSupportReply(
  sessionId: string,
  messages: ChatMessage[],
  language = "en",
): AsyncGenerator<{ type: "text"; text: string } | { type: "done"; escalate: boolean }> {
  const agentRecord  = await prisma.aiAgent.findUnique({ where: { name: AGENT_NAME } });
  const kbText       = await buildKbText(language);
  const systemPrompt = buildSupportSystemPrompt(kbText, language);

  const sanitisedMessages: { role: "user" | "assistant"; content: string }[] = messages.map((m) =>
    m.role === "user" ? { role: "user" as const, content: wrapAsData("customer_message", m.content) } : { role: "assistant" as const, content: m.content },
  );

  let fullText = "";

  for await (const chunk of streamProvider(
    AGENT_NAME,
    [{ role: "system", content: systemPrompt }, ...sanitisedMessages],
    { maxTokens: 512 },
  )) {
    if (chunk.type === "text") {
      fullText += chunk.text;
      yield { type: "text", text: chunk.text };
    } else {
      if (agentRecord) {
        await recordSpend(chunk.costCents, agentRecord.id);
        await log({ agentId: agentRecord.id, action: "chat_stream", message: `Session ${sessionId} via ${chunk.provider}`, tokensUsed: chunk.inputTokens + chunk.outputTokens, costCents: chunk.costCents });
      }
      yield { type: "done", escalate: /connect you with|our team|whatsapp|vtcbcn2025/i.test(fullText) };
    }
  }
}

async function updateKbUsage(userMessage: string): Promise<void> {
  const words = sanitize(userMessage).toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!words.length) return;

  const entries = await prisma.knowledgeBase.findMany({
    where: { OR: words.map((w) => ({ question: { contains: w, mode: "insensitive" as const } })), isActive: true },
    take: 3, select: { id: true },
  });

  for (const e of entries) {
    await prisma.knowledgeBase.update({ where: { id: e.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } }).catch(() => {});
  }
}
