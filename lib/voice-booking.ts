/**
 * Turning a finished phone conversation into a booking, and telling the caller what happened.
 *
 * Used by both phone agents. The booking itself is the website chat's: the same quote, the same booking record, the same SumUp
 * link. Nothing here prices anything.
 */

import { createBookingFromChat, type ChatBookingDraft } from "@/lib/ai/bookingFromChat";
import { sendSms } from "@/lib/sms";
import { notifyAdmin } from "@/lib/whatsapp";
import { say, spokenToEmail, twiml, type VoiceLang } from "@/lib/voice-agent";

const FAILED = {
  en: "I could not finish that booking myself. A colleague will call you back on this number shortly. Thank you for calling.",
  es: "No he podido terminar la reserva yo mismo. Un compañero le llamará a este número en breve. Gracias por llamar.",
};

/** "Your reference is E B C 1 2 3": letters and digits one at a time, which is how a reference is heard correctly. */
function spellOut(ref: string, lang: VoiceLang): string {
  const v = lang === "es" ? "Polly.Lucia-Neural" : "Polly.Amy-Neural";
  const l = lang === "es" ? "es-ES" : "en-GB";
  return `<Say voice="${v}" language="${l}"><say-as interpret-as="characters">${ref.replace(/[^A-Za-z0-9]/g, "")}</say-as></Say>`;
}

export async function bookByPhone(draft: ChatBookingDraft, ctx: { callSid: string; from: string; lang: VoiceLang }): Promise<Response> {
  const { callSid, from, lang } = ctx;
  const result = await createBookingFromChat(
    { ...draft, phone: draft.phone || from, email: spokenToEmail(draft.email || "") },
    callSid,
    "phone",
  ).catch((e) => ({ success: false as const, error: (e as Error)?.message }));

  if (!result.success) {
    await notifyAdmin(
      `Phone agent could not create a booking.\nCall: ${callSid}\nFrom: ${from}\nCaller: ${draft.name} · ${draft.pickup} → ${draft.dropoff} · ${draft.date} ${draft.time}\nReason: ${result.error ?? "unknown"}\nPlease call them back.`,
    ).catch(() => {});
    return twiml(say(FAILED[lang], lang) + "<Hangup/>");
  }

  const amount = Math.round(result.amount ?? 0);
  const link = result.paymentUrl?.startsWith("/") ? `https://www.elitebcn.info${result.paymentUrl}` : result.paymentUrl;
  await sendSms(draft.phone || from, `Elite BCN: booking ${result.reference} for EUR ${amount}. Pay securely to confirm: ${link}`, { bookingId: result.bookingId }).catch(() => {});
  await notifyAdmin(`Phone booking ${result.reference}: ${draft.name}, ${draft.pickup} → ${draft.dropoff}, ${draft.date} ${draft.time}, EUR ${amount}. Awaiting payment.`).catch(() => {});

  const lead = lang === "es" ? "Hecho. Su referencia es " : "Done. Your booking reference is ";
  const tail = lang === "es"
    ? `. El precio es ${amount} euros, y le he enviado el enlace de pago por mensaje de texto. La reserva se confirma cuando pague. Gracias por llamar a Elite BCN Transfers.`
    : `. The price is ${amount} euros, and I have sent the payment link by text message. The booking is confirmed once you pay. Thank you for calling Elite BCN Transfers.`;
  return twiml(say(lead, lang) + spellOut(result.reference ?? "", lang) + say(tail, lang) + "<Hangup/>");
}
