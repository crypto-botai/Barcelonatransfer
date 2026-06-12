import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isBudgetAvailable } from "@/lib/ai/budget";
import { streamSupportReply } from "@/lib/ai/agents/support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit: 10 messages per IP per hour (in-memory, resets on cold start — good enough for edge abuse prevention)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const hour = 60 * 60 * 1000;
  const rl   = rateLimits.get(ip);

  if (!rl || now > rl.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + hour });
    return true;
  }
  if (rl.count >= 10) return false;
  rl.count++;
  return true;
}

const schema = z.object({
  sessionId: z.string().min(1).max(64),
  messages:  z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).min(1).max(40),
  language: z.string().default("en"),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many messages. Please wait before sending more." }, { status: 429 });
  }

  if (!(await isBudgetAvailable())) {
    return NextResponse.json({
      reply: "Our AI assistant is temporarily unavailable. Please contact us via WhatsApp at +34 635 383 712 or email vtcbcn2025@gmail.com.",
      escalate: true,
    });
  }

  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionId, messages, language } = body.data;

  // Save/update conversation log asynchronously
  const saveConversation = async () => {
    const existing = await prisma.conversationLog.findFirst({ where: { sessionId } });
    if (existing) {
      await prisma.conversationLog.update({
        where: { id: existing.id },
        data:  { messages: messages as object[], language, updatedAt: new Date() },
      });
    } else {
      await prisma.conversationLog.create({
        data: { sessionId, visitorIp: ip, messages: messages as object[], language },
      });
    }
  };

  // Stream the response as SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      try {
        for await (const chunk of streamSupportReply(sessionId, messages, language)) {
          if (chunk.type === "text") {
            enqueue(JSON.stringify({ text: chunk.text }));
          } else {
            enqueue(JSON.stringify({ done: true, escalate: chunk.escalate }));
            // Update escalation flag in DB if needed
            if (chunk.escalate) {
              await prisma.conversationLog
                .updateMany({ where: { sessionId }, data: { escalated: true, escalatedAt: new Date() } })
                .catch(() => {});
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        enqueue(JSON.stringify({ error: msg }));
      } finally {
        controller.close();
      }

      // Save conversation non-blocking
      saveConversation().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
