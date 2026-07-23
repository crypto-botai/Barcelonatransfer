import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isBudgetAvailable } from "@/lib/ai/budget";
import { streamSupportReply } from "@/lib/ai/agents/support";
import { createBookingFromChat, type ChatBookingDraft } from "@/lib/ai/bookingFromChat";
import { COMPANY } from "@/lib/company-facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rate limit: 10 messages per IP per hour (in-memory, resets on cold start)
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

const OPEN_TAG  = "<BOOKING_JSON>";
const CLOSE_TAG = "</BOOKING_JSON>";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many messages. Please wait before sending more." }, { status: 429 });
  }

  if (!(await isBudgetAvailable())) {
    return NextResponse.json({
      reply:   `Our AI assistant is temporarily unavailable. Please contact us via WhatsApp at +34 635 383 712 or email ${COMPANY.email}.`,
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

      // Streaming state machine for BOOKING_JSON interception
      let pending   = "";   // text received but not yet forwarded (scanning for open tag)
      let jsonBuf   = "";   // text captured inside <BOOKING_JSON>…</BOOKING_JSON>
      let state: "streaming" | "in_json" | "after_json" = "streaming";
      let escalate  = false;

      try {
        for await (const chunk of streamSupportReply(sessionId, messages, language)) {
          if (chunk.type === "done") {
            escalate = chunk.escalate;
            continue;
          }

          const text = chunk.text;

          if (state === "streaming") {
            pending += text;

            const openIdx = pending.indexOf(OPEN_TAG);
            if (openIdx >= 0) {
              // Forward everything before the tag
              const before = pending.substring(0, openIdx);
              if (before) enqueue(JSON.stringify({ text: before }));
              // Start capturing JSON (text after the open tag)
              jsonBuf = pending.substring(openIdx + OPEN_TAG.length);
              pending = "";
              state = "in_json";
            } else {
              // Stream safely — hold back (OPEN_TAG.length - 1) chars in case the tag straddles chunks
              const holdBack = OPEN_TAG.length - 1;
              const safeLen  = Math.max(0, pending.length - holdBack);
              if (safeLen > 0) {
                enqueue(JSON.stringify({ text: pending.substring(0, safeLen) }));
                pending = pending.substring(safeLen);
              }
            }
          } else if (state === "in_json") {
            jsonBuf += text;
            const closeIdx = jsonBuf.indexOf(CLOSE_TAG);
            if (closeIdx >= 0) {
              const jsonStr  = jsonBuf.substring(0, closeIdx);
              const afterTag = jsonBuf.substring(closeIdx + CLOSE_TAG.length);
              jsonBuf = jsonStr;
              state   = "after_json";
              if (afterTag.trim()) enqueue(JSON.stringify({ text: afterTag }));
            }
          } else {
            // after_json: stream normally
            enqueue(JSON.stringify({ text }));
          }
        }

        // Flush any remaining pending text
        if (state === "streaming" && pending) {
          enqueue(JSON.stringify({ text: pending }));
        }

        // Done event
        enqueue(JSON.stringify({ done: true, escalate }));

        // Handle escalation flag in DB
        if (escalate) {
          await prisma.conversationLog
            .updateMany({ where: { sessionId }, data: { escalated: true, escalatedAt: new Date() } })
            .catch(() => {});
        }

        // Process booking JSON if intercepted
        if ((state === "in_json" || state === "after_json") && jsonBuf.trim()) {
          try {
            const draft = JSON.parse(jsonBuf.trim()) as ChatBookingDraft;
            const result = await createBookingFromChat(draft, sessionId, ip);

            if (result.success) {
              enqueue(JSON.stringify({
                booking: {
                  id:        result.bookingId,
                  reference: result.reference,
                  paymentUrl: result.paymentUrl,
                  amount:    result.amount,
                  currency:  result.currency,
                },
              }));
            } else {
              enqueue(JSON.stringify({
                booking: {
                  error:    result.error ?? "Could not create booking automatically.",
                  whatsapp: "https://wa.me/34635383712",
                },
              }));
            }
          } catch {
            enqueue(JSON.stringify({
              booking: {
                error:    "Booking processing failed. Please contact us via WhatsApp.",
                whatsapp: "https://wa.me/34635383712",
              },
            }));
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
      "Content-Type":     "text/event-stream",
      "Cache-Control":    "no-cache",
      "Connection":       "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
