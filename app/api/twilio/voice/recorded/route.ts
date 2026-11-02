import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmin } from "@/lib/whatsapp";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";
import { say, twiml, type VoiceLang } from "@/lib/voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A caller left a message. It is filed and the office is told where to listen and who to call back. */
export async function POST(req: NextRequest) {
  const params = await formParams(req).catch(() => ({} as Record<string, string>));
  const url = new URL(req.url);
  const ok = validTwilioSignature(
    candidateWebhookUrls(`${url.pathname}${url.search}`, req.url),
    params,
    req.headers.get("x-twilio-signature"),
    process.env.TWILIO_AUTH_TOKEN,
  );
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const lang: VoiceLang = url.searchParams.get("lang") === "es" ? "es" : "en";
  const from = (params.From || "").trim();
  const recording = (params.RecordingUrl || "").trim();
  const seconds = params.RecordingDuration || "";

  if (recording) {
    await prisma.activityLog
      .create({ data: { action: "VOICE_MESSAGE", entity: "Call", entityId: null, details: { from, recording, seconds, callSid: params.CallSid ?? null } } })
      .catch((e) => console.error("[voice] could not file message:", (e as Error)?.message));
    await notifyAdmin(`Voice message from ${from || "unknown number"} (${seconds || "?"} s). Listen: ${recording}.mp3 (sign in to Twilio to play). Please call them back.`).catch(() => {});
  }

  return twiml(say(lang === "es" ? "Gracias, le llamaremos en breve. Adiós." : "Thank you, we will call you back shortly. Goodbye.", lang) + "<Hangup/>");
}
