import { NextRequest, NextResponse } from "next/server";
import { COMPANY } from "@/lib/company-facts";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";
import { sendSms } from "@/lib/sms";
import { dialOffice, menuResponse, say, twiml, type VoiceLang } from "@/lib/voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The key the caller pressed on the menu.
 *   1  a text message with the booking link and the office's WhatsApp
 *   2  through to the office phone
 *   3  leave a message, which goes to /api/twilio/voice/recorded
 *   9  the other language
 * Anything else, or no key, plays the menu again.
 */
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
  const n = Math.max(0, Number(url.searchParams.get("n")) || 0);
  const digit = (params.Digits || "").trim();
  const from = (params.From || "").trim();

  if (digit === "9") return menuResponse(lang === "en" ? "es" : "en", 0);
  if (digit === "2") return dialOffice(COMPANY.phone, lang, lang === "es" ? "Le pasamos con el equipo." : "Putting you through to the team.");

  if (digit === "1") {
    const text = lang === "es"
      ? `Elite BCN: reserve su traslado con precio fijo aqui: https://www.elitebcn.info/book . Tambien por WhatsApp: ${COMPANY.phoneDisplay}`
      : `Elite BCN: book your transfer at a fixed price here: https://www.elitebcn.info/book . Or WhatsApp us: ${COMPANY.phoneDisplay}`;
    const sent = await sendSms(from, text).catch(() => ({ outcome: "failed" as const }));
    const line = sent.outcome === "sent"
      ? (lang === "es" ? "Le hemos enviado el enlace por mensaje de texto. Gracias por llamar." : "We have sent you the booking link by text message. Thank you for calling.")
      : (lang === "es" ? "No hemos podido enviar el mensaje a este número. Reserve en elite b c n punto info. Gracias por llamar." : "We could not text this number. Please book at elite b c n dot info. Thank you for calling.");
    return twiml(say(line, lang) + "<Hangup/>");
  }

  if (digit === "3") {
    const prompt = lang === "es"
      ? "Después de la señal, diga su nombre, la recogida, el destino, la fecha y el número de pasajeros. Su mensaje quedará grabado. Cuelgue cuando termine."
      : "After the beep, say your name, the pickup, the destination, the date and the number of passengers. Your message will be recorded. Hang up when you are done.";
    return twiml(say(prompt, lang) + `<Record maxLength="120" playBeep="true" trim="trim-silence" action="/api/twilio/voice/recorded?lang=${lang}" method="POST"/>`);
  }

  return menuResponse(lang, n + 1);
}
