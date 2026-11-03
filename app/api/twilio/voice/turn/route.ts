import { NextRequest, NextResponse } from "next/server";
import { COMPANY } from "@/lib/company-facts";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";
import { getSupportReply } from "@/lib/ai/agents/support";
import { isBudgetAvailable } from "@/lib/ai/budget";
import { bookByPhone } from "@/lib/voice-booking";
import { notifyAdmin } from "@/lib/whatsapp";
import {
  MAX_TURNS, dialOffice, forSpeech, gatherAndSay, loadTurns, saveTurn, say, splitBooking, twiml,
  voiceAgentEnabled, wantsHuman, wantsSpanish, type VoiceLang,
} from "@/lib/voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A turn waits for a model: give it room, but not so much that a stuck one holds the line.
export const maxDuration = 30;

const next = (lang: VoiceLang, n: number) => `/api/twilio/voice/turn?lang=${lang}&n=${n}`;
const again = (lang: VoiceLang, n: number) => `<Redirect method="POST">${next(lang, n).replace(/&/g, "&amp;")}&amp;silent=1</Redirect>`;

const T = {
  en: {
    noHear: "Sorry, I did not catch that. Could you say it again?",
    giveUp: "I could not hear you, so I will put you through to the team.",
    busy: "Sorry, I cannot take bookings right now. I will put you through to the team.",
    long: "This is taking a while, so I will put you through to the team.",
    human: "Of course. Putting you through now.",
    failed: "I could not finish that booking myself. A colleague will call you back on this number shortly. Thank you for calling.",
    anythingElse: "Is there anything else I can help with?",
    bye: "Thank you for calling Elite BCN Transfers. Goodbye.",
  },
  es: {
    noHear: "Perdone, no le he entendido. ¿Puede repetirlo?",
    giveUp: "No le oigo bien, así que le paso con el equipo.",
    busy: "Lo siento, ahora mismo no puedo tomar reservas. Le paso con el equipo.",
    long: "Esto se está alargando, así que le paso con el equipo.",
    human: "Por supuesto. Le paso ahora.",
    failed: "No he podido terminar la reserva yo mismo. Un compañero le llamará a este número en breve. Gracias por llamar.",
    anythingElse: "¿Puedo ayudarle con algo más?",
    bye: "Gracias por llamar a Elite BCN Transfers. Adiós.",
  },
} as const;

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

  let lang: VoiceLang = url.searchParams.get("lang") === "es" ? "es" : "en";
  const n = Math.max(0, Number(url.searchParams.get("n")) || 0);
  const callSid = (params.CallSid || "").trim();
  const from = (params.From || "").trim();
  const speech = (params.SpeechResult || "").trim().slice(0, 500);

  if (!voiceAgentEnabled() || !callSid) return dialOffice(COMPANY.phone, lang);

  // Nothing was heard. One more try, then a person.
  if (!speech) {
    if (n >= 2) return dialOffice(COMPANY.phone, lang, T[lang].giveUp);
    return twiml(gatherAndSay(T[lang].noHear, lang, next(lang, n + 1)) + again(lang, n + 1));
  }

  if (wantsHuman(speech)) return dialOffice(COMPANY.phone, lang, T[lang].human);
  if (lang === "en" && wantsSpanish(speech)) {
    lang = "es";
    return twiml(gatherAndSay("Por supuesto, hablamos en español. ¿En qué puedo ayudarle?", "es", next("es", 0)) + again("es", 0));
  }

  if (!(await isBudgetAvailable())) return dialOffice(COMPANY.phone, lang, T[lang].busy);

  const history = await loadTurns(callSid);
  if (history.length >= MAX_TURNS * 2) return dialOffice(COMPANY.phone, lang, T[lang].long);

  const turns = [...history, { role: "user" as const, content: speech }];
  await saveTurn(callSid, "user", speech);

  let reply: string;
  try {
    ({ reply } = await getSupportReply(callSid, turns, lang, { callerNumber: from }));
  } catch (e) {
    console.error("[voice] model failed:", (e as Error)?.message);
    return dialOffice(COMPANY.phone, lang, T[lang].busy);
  }

  const { speech: spoken, draft, malformed } = splitBooking(reply);
  await saveTurn(callSid, "assistant", reply);

  if (!draft) {
    // A broken block means the booking was meant to be made but cannot be read: do not keep the caller talking to nobody.
    if (malformed) {
      await notifyAdmin(`Phone agent could not read a booking from call ${callSid} (${from}). Please call them back.`).catch(() => {});
      return twiml(say(T[lang].failed, lang));
    }
    return twiml(gatherAndSay(forSpeech(spoken) || T[lang].noHear, lang, next(lang, n + 1)) + again(lang, n + 1));
  }

  return bookByPhone(draft, { callSid, from, lang });
}
