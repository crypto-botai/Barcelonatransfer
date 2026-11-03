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

/**
 * "guided" (default): fixed questions in order, answers read by code. "menu": keypad menu, no AI. "ai": the free-speech
 * assistant that lets a model run the whole conversation (it misheard callers, so it is opt-in).
 */
export function voiceAgentMode(): "guided" | "menu" | "ai" {
  const m = process.env.VOICE_AGENT_MODE;
  return m === "menu" || m === "ai" ? m : "guided";
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

// ─── The keypad menu ─────────────────────────────────────────────────────────────────────────────────────────────────────

const MENU: Record<VoiceLang, string> = {
  en:
    "Hello, you have reached Elite BCN Transfers. To receive a booking link by text message, press 1. " +
    "To speak to our team, press 2. To leave a message, press 3. Para español, pulse 9.",
  es:
    "Hola, ha llamado a Elite BCN Transfers. Para recibir un enlace de reserva por mensaje de texto, pulse 1. " +
    "Para hablar con nuestro equipo, pulse 2. Para dejar un mensaje, pulse 3. For English, press 9.",
};

/** Says the menu and waits for one key. No key twice running puts the caller through to the office. */
export function menuResponse(lang: VoiceLang, attempt: number): Response {
  if (attempt >= 2) return dialOffice(OFFICE_PHONE, lang);
  const v = VOICES[lang];
  const action = `/api/twilio/voice/menu?lang=${lang}&amp;n=${attempt}`;
  return twiml(
    `<Gather input="dtmf" numDigits="1" timeout="6" action="${action}" method="POST">${say(MENU[lang], lang)}</Gather>` +
      `<Redirect method="POST">${action}&amp;none=1</Redirect>`,
  );
}

const OFFICE_PHONE = "+34635383712";

// ─── The guided flow's place in the call ────────────────────────────────────────────────────────────────────────────────

import type { FlowState } from "@/lib/voice-flow";

/** The latest saved state of this call, or null on its first turn. */
export async function loadState(callSid: string): Promise<FlowState | null> {
  const row = await prisma.activityLog.findFirst({
    where: { action: "VOICE_STATE", details: { path: ["callSid"], equals: callSid } },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
  const d = row?.details as { state?: FlowState } | null;
  return d?.state ?? null;
}

export async function saveState(callSid: string, state: FlowState): Promise<void> {
  await prisma.activityLog
    .create({ data: { action: "VOICE_STATE", entity: "Call", entityId: null, details: { callSid, state: state as unknown as object } } })
    .catch((e) => console.error("[voice] could not save state:", (e as Error)?.message));
}

/** Listens for one answer, by voice or by keypad, then posts it to `action`. */
export function gatherStep(text: string, lang: VoiceLang, action: string, digits: number): string {
  const v = VOICES[lang];
  const hints = "Barcelona, El Prat, airport, Terminal 1, Terminal 2, Sants, Tarragona, Sitges, Andorra, Girona, Montserrat, PortAventura, hotel, tomorrow, today, yes, no";
  const input = digits ? "speech dtmf" : "speech";
  const dtmf = digits ? ` numDigits="${digits}"` : "";
  return (
    `<Gather input="${input}"${dtmf} language="${v.gather}" speechTimeout="auto" speechModel="phone_call" enhanced="true" hints="${esc(hints)}" ` +
    `action="${esc(action)}" method="POST">${say(text, lang)}</Gather>`
  );
}
