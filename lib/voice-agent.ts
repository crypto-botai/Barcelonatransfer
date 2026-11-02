/**
 * The phone booking agent: the pieces that are not Twilio's or the model's.
 *
 * A call is a loop of short HTTP requests. Twilio listens, turns the caller's words into text, posts them to
 * /api/twilio/voice/turn, and says whatever TwiML comes back. Nothing here holds a connection open, so it runs on the same
 * serverless host as the rest of the site.
 *
 * It is off unless VOICE_AGENT_ENABLED is "true". While off, a call is passed straight to the office phone.
 */

import { prisma } from "@/lib/prisma";
import type { ChatBookingDraft } from "@/lib/ai/bookingFromChat";

export type VoiceLang = "en" | "es";

export function voiceAgentEnabled(): boolean {
  return process.env.VOICE_AGENT_ENABLED === "true";
}

/** The most turns a call may take before it is handed to a person. Bounds cost on a call that goes round in circles. */
export const MAX_TURNS = 24;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const VOICES: Record<VoiceLang, { voice: string; language: string; gather: string }> = {
  en: { voice: "Polly.Amy-Neural", language: "en-GB", gather: "en-GB" },
  es: { voice: "Polly.Lucia-Neural", language: "es-ES", gather: "es-ES" },
};

export function say(text: string, lang: VoiceLang): string {
  const v = VOICES[lang];
  return `<Say voice="${v.voice}" language="${v.language}">${esc(text)}</Say>`;
}

/** Listens for one utterance, then posts it to `action`. Words in `hints` help the recogniser with place names. */
export function gatherAndSay(text: string, lang: VoiceLang, action: string): string {
  const v = VOICES[lang];
  const hints = "Barcelona, El Prat, Terminal 1, Terminal 2, Sants, Tarragona, Sitges, Andorra, Girona, Montserrat, PortAventura, flight number";
  return (
    `<Gather input="speech" language="${v.gather}" speechTimeout="auto" speechModel="phone_call" enhanced="true" hints="${esc(hints)}" ` +
    `action="${esc(action)}" method="POST">${say(text, lang)}</Gather>`
  );
}

export function twiml(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/** Hands the call to a person. The number is the office's own. */
export function dialOffice(phone: string, lang: VoiceLang, sentence?: string): Response {
  return twiml(`${sentence ? say(sentence, lang) : ""}<Dial>${esc(phone)}</Dial>`);
}

/** The caller asks for a person. */
export function wantsHuman(speech: string): boolean {
  return /\b(human|person|agent|operator|someone|representative|real person|persona|humano|operador|operadora|agente)\b/i.test(speech);
}

export function wantsSpanish(speech: string): boolean {
  return /\b(espa(n|ñ)ol|spanish|castellano|hablo espa)/i.test(speech);
}

/**
 * Recognisers write an email address as it sounds: "john dot smith at gmail dot com". Turn that back into an address. Only
 * used as a safety net, since the model is asked to read the address back and has usually written it properly by then.
 */
export function spokenToEmail(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+(at|arroba)\s+/g, "@")
    .replace(/\s+(dot|punto)\s+/g, ".")
    .replace(/\s+(underscore|guion bajo)\s+/g, "_")
    .replace(/\s+(dash|hyphen|guion)\s+/g, "-")
    .replace(/\s+/g, "");
}

const OPEN = "<BOOKING_JSON>";
const CLOSE = "</BOOKING_JSON>";

/** Splits the model's reply into what to say and, if it finished the booking, the draft. */
export function splitBooking(reply: string): { speech: string; draft: ChatBookingDraft | null; malformed: boolean } {
  const a = reply.indexOf(OPEN);
  if (a < 0) return { speech: reply.trim(), draft: null, malformed: false };
  const b = reply.indexOf(CLOSE, a);
  const speech = (reply.slice(0, a) + (b >= 0 ? reply.slice(b + CLOSE.length) : "")).trim();
  if (b < 0) return { speech, draft: null, malformed: true };
  try {
    const d = JSON.parse(reply.slice(a + OPEN.length, b).trim()) as ChatBookingDraft;
    return { speech, draft: d, malformed: false };
  } catch {
    return { speech, draft: null, malformed: true };
  }
}

/** Text read aloud by a voice: drop what a voice would spell out. */
export function forSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/^[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

// ─── The conversation so far, kept in the activity log ───────────────────────────────────────────────────────────────────
// A call has no browser to hold its history, and a new table would need a hand-run migration, so each turn is one row.

export interface Turn { role: "user" | "assistant"; content: string }

export async function loadTurns(callSid: string): Promise<Turn[]> {
  const rows = await prisma.activityLog.findMany({
    where: { action: "VOICE_TURN", details: { path: ["callSid"], equals: callSid } },
    orderBy: { createdAt: "asc" },
    take: MAX_TURNS * 2 + 2,
    select: { details: true },
  });
  return rows
    .map((r) => r.details as { role?: string; content?: string } | null)
    .filter((d): d is { role: "user" | "assistant"; content: string } => !!d && (d.role === "user" || d.role === "assistant") && typeof d.content === "string")
    .map((d) => ({ role: d.role, content: d.content }));
}

export async function saveTurn(callSid: string, role: Turn["role"], content: string): Promise<void> {
  await prisma.activityLog
    .create({ data: { action: "VOICE_TURN", entity: "Call", entityId: null, details: { callSid, role, content: content.slice(0, 1500) } } })
    .catch((e) => console.error("[voice] could not save turn:", (e as Error)?.message));
}
