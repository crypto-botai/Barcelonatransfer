import { NextRequest, NextResponse } from "next/server";
import { COMPANY } from "@/lib/company-facts";
import { candidateWebhookUrls, formParams, validTwilioSignature } from "@/lib/twilio-webhook";
import { notifyAdmin } from "@/lib/whatsapp";
import { isBudgetAvailable } from "@/lib/ai/budget";
import {
  dialOffice, gatherStep, loadState, saveState, saveTurn, twiml, voiceAgentEnabled, wantsHuman, wantsSpanish,
} from "@/lib/voice-agent";
import { applyWhen, gatherFor, initialState, prompt, step, whenFailed, type FlowState, type Reply } from "@/lib/voice-flow";
import { readWhen } from "@/lib/voice-when";
import { bookByPhone } from "@/lib/voice-booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ACTION = "/api/twilio/voice/guided";

/** Says `text`, listens for the answer to the step the state is now at, and comes back here on silence. */
function ask(state: FlowState, text: string): Response {
  return twiml(
    gatherStep(text, state.lang, ACTION, gatherFor(state.step).digits, !!gatherFor(state.step).hash) +
      `<Redirect method="POST">${ACTION}</Redirect>`,
  );
}

/**
 * One turn of the guided call: the caller's answer in, the next question out. See lib/voice-flow.ts for the questions and for
 * how each answer is read. State between turns is kept in the activity log, since a phone call has no browser to hold it.
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

  const callSid = (params.CallSid || "").trim();
  const from = (params.From || "").trim();
  const speech = (params.SpeechResult || "").trim().slice(0, 300);
  const digits = (params.Digits || "").trim();
  if (!voiceAgentEnabled() || !callSid) return dialOffice(COMPANY.phone, "en");

  const state = (await loadState(callSid).catch(() => null)) ?? initialState();
  if (speech || digits) await saveTurn(callSid, "user", speech || `[keys ${digits}]`);

  if (wantsHuman(speech)) return dialOffice(COMPANY.phone, state.lang, state.lang === "es" ? "Por supuesto. Le paso ahora." : "Of course. Putting you through now.");

  // Spanish is offered in the greeting, on the first question.
  if (state.step === "pickup" && state.lang === "en" && wantsSpanish(speech)) {
    const es: FlowState = { ...state, lang: "es" };
    await saveState(callSid, es);
    return ask(es, "Por supuesto, hablamos en español. " + prompt("pickup", "es"));
  }

  let reply: Reply = step(state, speech, digits);

  if (reply.needWhen) {
    if (!(await isBudgetAvailable().catch(() => false))) reply = whenFailed({ ...state, fails: 9 });
    else {
      const { date, time } = await readWhen(reply.needWhen);
      reply = applyWhen(state, date, time);
    }
  }

  await saveState(callSid, reply.state);

  if (reply.handoff) {
    const s = reply.state.slots;
    await notifyAdmin(
      `Phone agent handed a call to the office.\nFrom: ${from}\nSo far: ${s.name ?? "?"} · ${s.pickup ?? "?"} → ${s.dropoff ?? "?"} · ${s.date ?? "?"} ${s.time ?? ""} · ${s.passengers ?? "?"} pax
WhatsApp: ${s.whatsapp ? `+${s.whatsapp}` : "?"}`,
    ).catch(() => {});
    return dialOffice(COMPANY.phone, reply.state.lang, reply.say);
  }

  if (reply.book) {
    const s = reply.state.slots;
    return bookByPhone(
      {
        name: s.name ?? "", phone: s.whatsapp ? `+${s.whatsapp}` : from, email: "", pickup: s.pickup ?? "", dropoff: s.dropoff ?? "",
        date: s.date ?? "", time: s.time ?? "", passengers: s.passengers ?? 1, luggage: s.luggage ?? 0, flightNumber: s.flight ?? null,
      },
      { callSid, from, lang: reply.state.lang },
    );
  }

  await saveTurn(callSid, "assistant", reply.say);
  return ask(reply.state, reply.say);
}
