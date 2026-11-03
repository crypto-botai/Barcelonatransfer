/**
 * The guided phone booking: fixed questions, asked in order, one at a time.
 *
 * The first phone agent let a language model run the whole conversation, and people were misunderstood. Here the order of
 * questions is fixed and the answers are read by plain code. The only thing a model is asked to read is the day and time,
 * which is the one answer that comes in too many shapes ("tomorrow at five", "next Friday morning") to parse by hand.
 *
 * Everything in this file is pure. The routes do the talking to Twilio, the model, the database and the booking engine.
 */

import type { VoiceLang } from "@/lib/voice-agent";
import { pickupToUtc } from "@/lib/datetime";

export type Step = "pickup" | "dropoff" | "flight" | "when" | "pax" | "bags" | "name" | "email" | "email_ok" | "confirm" | "change";

export interface Slots {
  pickup?: string;
  dropoff?: string;
  flight?: string | null;
  date?: string;
  time?: string;
  passengers?: number;
  luggage?: number;
  name?: string;
  email?: string;
}

export interface FlowState {
  lang: VoiceLang;
  step: Step;
  slots: Slots;
  /** Failed attempts at the current step. Two in a row put the caller through to a person. */
  fails: number;
  /** Set while the caller is changing one answer: after it, go back to the confirmation instead of on through every step. */
  back?: boolean;
}

export const initialState = (): FlowState => ({ lang: "en", step: "pickup", slots: {}, fails: 0 });

export const MAX_FAILS = 2;

// ─── Reading answers ─────────────────────────────────────────────────────────────────────────────────────────────────────

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  none: 0, no: 0, ninguna: 0, ninguno: 0, nada: 0,
};

/** A small count from keys pressed or words spoken. "two", "2", "just me" (one), "nothing" (none). */
export function parseCount(speech: string, digits = ""): number | null {
  const d = digits.replace(/\D/g, "");
  if (d) return Number(d);
  const t = speech.toLowerCase();
  const num = t.match(/\b\d{1,2}\b/);
  if (num) return Number(num[0]);
  if (/\b(just me|only me|solo yo|solo)\b/.test(t)) return 1;
  for (const w of t.split(/[^a-záéíóúñ]+/)) if (w in WORDS) return WORDS[w];
  return null;
}

export function parseYesNo(speech: string, digits = ""): boolean | null {
  if (digits === "1") return true;
  if (digits === "2") return false;
  const t = speech.toLowerCase();
  if (/(?<![\p{L}])(no|nope|wrong|incorrect|change|not right|negative|incorrecto|cambiar)(?![\p{L}])/iu.test(t)) return false;
  if (/(?<![\p{L}])(yes|yeah|yep|yup|correct|right|sure|ok|okay|book it|confirm|si|sí|vale|claro|correcto|perfecto|exacto)(?![\p{L}])/iu.test(t)) return true;
  return null;
}

/** Strips the words people wrap round an answer: "I'd like to be picked up from the Hotel Arts" becomes "the Hotel Arts". */
export function cleanPlace(speech: string): string {
  return speech
    .replace(/[.?!]+$/g, "")
    .replace(/^(?:please\s+)?(?:i(?:'d| would)?\s+(?:like|want|need)\s+to\s+be\s+(?:picked up|collected)|pick me up|take me|i(?:'m| am)\s+(?:at|in))\s*/i, "")
    .replace(/^(?:from|at|in|to|desde|en|hasta|a)\s+/i, "")
    .trim()
    .slice(0, 160);
}

export const mentionsAirport = (s: string | undefined) => !!s && /\b(airport|aeropuerto|aeroport|bcn|el prat|terminal|t1|t2)\b/i.test(s);

/** "v y one two three four" or "VY1234" or "vueling 1234": two letters or digits then up to four digits. */
export function parseFlight(speech: string): string | null | "skip" {
  if (/\b(no flight|no|none|don't know|dont know|not sure|skip|sin vuelo|ninguno|no lo sé|no lo se)\b/i.test(speech) && !/\d/.test(speech)) return "skip";
  const spoken = speech
    .toLowerCase()
    .replace(/\b(zero|oh)\b/g, "0").replace(/\bone\b/g, "1").replace(/\btwo\b/g, "2").replace(/\bthree\b/g, "3").replace(/\bfour\b/g, "4")
    .replace(/\bfive\b/g, "5").replace(/\bsix\b/g, "6").replace(/\bseven\b/g, "7").replace(/\beight\b/g, "8").replace(/\bnine\b/g, "9")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
  const m = spoken.match(/([A-Z0-9]{2})(\d{1,4})/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** A name from "my name is Ana Ruiz", "it's Ana Ruiz", or just "Ana Ruiz". */
export function parseName(speech: string): string | null {
  const n = speech
    .replace(/[.?!,]+/g, " ")
    .replace(/^(hi|hello|hola)\b\s*/i, "")
    .replace(/^(my name is|my name's|it's|it is|this is|i am|i'm|me llamo|mi nombre es|soy)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return n.length >= 2 && n.length <= 60 && /[a-záéíóúñ]/i.test(n) ? n.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

export function parseEmail(speech: string): string | null {
  const e = speech
    .toLowerCase()
    .replace(/[.,;]+$/g, "")
    .replace(/\s+(at|arroba)\s+/g, "@")
    .replace(/\s+(dot|punto)\s+/g, ".")
    .replace(/\s+(underscore|guion bajo)\s+/g, "_")
    .replace(/\s+(dash|hyphen|guion)\s+/g, "-")
    .replace(/\s+/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

/** Which part the caller wants to change. */
export function parseChange(speech: string): Step | null {
  const t = speech.toLowerCase();
  const has = (words: string) => new RegExp(`(?<![\p{L}])(${words})(?![\p{L}])`, "iu").test(t);
  if (has("pick ?up|from|origin|recogida|origen")) return "pickup";
  if (has("drop ?off|destination|to|going|destino|hasta")) return "dropoff";
  if (has("time|day|date|when|hour|fecha|hora|día|dia")) return "when";
  if (has("passengers?|people|persons?|pax|pasajeros?|personas?")) return "pax";
  if (has("suitcases?|bags?|luggage|maletas?|equipaje")) return "bags";
  if (has("name|nombre")) return "name";
  if (has("e-?mail|mail|correo")) return "email";
  if (has("flight|vuelo")) return "flight";
  return null;
}

// ─── What is said ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** An address or email read aloud: "ana dot ruiz at gmail dot com". */
export const emailAloud = (e: string, lang: VoiceLang) =>
  e.replace(/@/g, lang === "es" ? " arroba " : " at ").replace(/\./g, lang === "es" ? " punto " : " dot ");

const P = {
  en: {
    pickup: "Where should we pick you up? You can say a hotel, an address, or the airport.",
    dropoff: "And where are you going?",
    flight: "What is your flight number? Say it slowly, or say no flight.",
    when: "What day and time would you like the pickup?",
    pax: "How many passengers? Say a number, or press it on the keypad.",
    bags: "How many suitcases? Say a number, or say none.",
    name: "What is your name?",
    email: "Please say your email address slowly, like john dot smith at gmail dot com.",
    change: "What would you like to change? Say pickup, destination, time, passengers or name.",
    again: "Sorry, I did not catch that. ",
    num: "Sorry, please say just a number. ",
    when2: "Sorry, I did not get the day and time. Please say it like tomorrow at ten thirty, or the fifth of November at four pm.",
    past: "That time has already passed. What day and time would you like the pickup?",
    handoff: "I am sorry, I am having trouble. I will put you through to the team.",
    unknownChange: "Sorry, I did not understand which part. ",
  },
  es: {
    pickup: "¿Dónde le recogemos? Puede decir un hotel, una dirección o el aeropuerto.",
    dropoff: "¿Y adónde va?",
    flight: "¿Cuál es su número de vuelo? Dígalo despacio, o diga sin vuelo.",
    when: "¿Qué día y a qué hora quiere la recogida?",
    pax: "¿Cuántos pasajeros? Diga un número o púlselo en el teclado.",
    bags: "¿Cuántas maletas? Diga un número, o diga ninguna.",
    name: "¿Cómo se llama?",
    email: "Diga su correo electrónico despacio, por ejemplo juan punto perez arroba gmail punto com.",
    change: "¿Qué quiere cambiar? Diga recogida, destino, hora, pasajeros o nombre.",
    again: "Perdone, no le he entendido. ",
    num: "Perdone, diga solo un número. ",
    when2: "Perdone, no he entendido el día y la hora. Diga por ejemplo mañana a las diez y media, o el cinco de noviembre a las cuatro de la tarde.",
    past: "Esa hora ya ha pasado. ¿Qué día y a qué hora quiere la recogida?",
    handoff: "Lo siento, tengo problemas. Le paso con el equipo.",
    unknownChange: "Perdone, no he entendido qué parte. ",
  },
} as const;

export function prompt(step: Step, lang: VoiceLang): string {
  if (step === "email_ok" || step === "confirm") return "";
  return P[lang][step];
}

export const spokenDate = (date: string, lang: VoiceLang) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", { weekday: "long", day: "numeric", month: "long" });

export function confirmText(s: Slots, lang: VoiceLang): string {
  const when = `${spokenDate(s.date ?? "", lang)} at ${s.time}`;
  return lang === "es"
    ? `Vamos a comprobar. Recogida en ${s.pickup}, destino ${s.dropoff}, el ${spokenDate(s.date ?? "", lang)} a las ${s.time}, ${s.passengers} pasajeros, a nombre de ${s.name}. Pulse 1 o diga sí para reservar, o pulse 2 para cambiar algo.`
    : `Let me check. Pickup at ${s.pickup}, going to ${s.dropoff}, on ${when}, ${s.passengers} passengers, under the name ${s.name}. Press 1 or say yes to book, or press 2 to change something.`;
}

export const emailOkText = (email: string, lang: VoiceLang) =>
  lang === "es" ? `He entendido ${emailAloud(email, lang)}. ¿Es correcto? Pulse 1 para sí o 2 para no.` : `I heard ${emailAloud(email, lang)}. Is that correct? Press 1 for yes or 2 for no.`;

/** What the Gather should accept for this step. */
export function gatherFor(step: Step): { digits: number } {
  if (step === "pax" || step === "bags") return { digits: 2 };
  if (step === "email_ok" || step === "confirm") return { digits: 1 };
  return { digits: 0 };
}

// ─── The state machine ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The step after `step`, given what is known. */
function nextAfter(step: Step, s: Slots): Step {
  switch (step) {
    case "pickup": return "dropoff";
    case "dropoff": return mentionsAirport(s.pickup) || mentionsAirport(s.dropoff) ? "flight" : "when";
    case "flight": return "when";
    case "when": return "pax";
    case "pax": return "bags";
    case "bags": return "name";
    case "name": return "email";
    case "email": return "email_ok";
    case "email_ok": return "confirm";
    default: return "confirm";
  }
}

export interface Reply {
  state: FlowState;
  /** What to say next (already includes any "sorry" lead-in). */
  say: string;
  /** The caller asked for a person, or two answers in a row failed. */
  handoff?: boolean;
  /** The caller confirmed: create the booking. */
  book?: boolean;
  /** Needs the model to read a day and time from this speech. The route calls it and then `applyWhen`. */
  needWhen?: string;
}

/**
 * One answer in, the next question out. Returns `needWhen` rather than reading the day itself, so that this stays pure.
 *
 * After a successful `needWhen`, the route calls `applyWhen`; after a failed one, `whenFailed`.
 */
export function step(state: FlowState, speech: string, digits = ""): Reply {
  const { lang } = state;
  const s = state.slots;
  const fail = (lead: string): Reply => {
    const fails = state.fails + 1;
    if (fails >= MAX_FAILS) return { state: { ...state, fails }, say: P[lang].handoff, handoff: true };
    return { state: { ...state, fails }, say: lead + (prompt(state.step, lang) || (state.step === "email_ok" ? emailOkText(s.email ?? "", lang) : confirmText(s, lang))) };
  };
  const go = (slots: Slots, from: Step = state.step): Reply => {
    // After a change, go straight back to the confirmation. A changed email is still read back first.
    const to: Step = from === "email" ? "email_ok" : state.back ? "confirm" : nextAfter(from, slots);
    const ns: FlowState = { ...state, slots, step: to, fails: 0, back: to === "confirm" ? false : state.back };
    return { state: ns, say: to === "confirm" ? confirmText(slots, lang) : to === "email_ok" ? emailOkText(slots.email ?? "", lang) : prompt(to, lang) };
  };

  const text = speech.trim();
  if (!text && !digits) return fail(P[lang].again);

  switch (state.step) {
    case "pickup": {
      const v = cleanPlace(text);
      return v.length >= 2 ? go({ ...s, pickup: v }) : fail(P[lang].again);
    }
    case "dropoff": {
      const v = cleanPlace(text);
      return v.length >= 2 ? go({ ...s, dropoff: v }) : fail(P[lang].again);
    }
    case "flight": {
      const f = parseFlight(text);
      if (f === "skip") return go({ ...s, flight: null });
      return f ? go({ ...s, flight: f }) : fail(P[lang].again);
    }
    case "when":
      return text ? { state, say: "", needWhen: text } : fail(P[lang].again);
    case "pax": {
      const n = parseCount(text, digits);
      return n && n >= 1 && n <= 16 ? go({ ...s, passengers: n }) : fail(P[lang].num);
    }
    case "bags": {
      const n = parseCount(text, digits);
      return n !== null && n >= 0 && n <= 20 ? go({ ...s, luggage: n }) : fail(P[lang].num);
    }
    case "name": {
      const n = parseName(text);
      return n ? go({ ...s, name: n }) : fail(P[lang].again);
    }
    case "email": {
      const e = parseEmail(text);
      return e ? go({ ...s, email: e }) : fail(P[lang].again);
    }
    case "email_ok": {
      const yn = parseYesNo(text, digits);
      if (yn === true) return go(s);
      if (yn === false) return { state: { ...state, step: "email", fails: 0 }, say: P[lang].email };
      return fail(P[lang].again);
    }
    case "confirm": {
      const yn = parseYesNo(text, digits);
      if (yn === true) return { state: { ...state, fails: 0 }, say: "", book: true };
      if (yn === false) return { state: { ...state, step: "change", fails: 0 }, say: P[lang].change };
      return fail(P[lang].again);
    }
    case "change": {
      const to = parseChange(text);
      if (!to) return fail(P[lang].unknownChange);
      return { state: { ...state, step: to, fails: 0, back: true }, say: prompt(to, lang) };
    }
  }
}

/** The model read a day and time: either use it or ask again. `now` is injectable for tests. */
export function applyWhen(state: FlowState, date: string | null, time: string | null, now = new Date()): Reply {
  const { lang } = state;
  const ok = !!date && !!time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!ok) return whenFailed(state);
  const when = pickupToUtc(date!, time!);
  if (!when) return whenFailed(state);
  if (when.getTime() < now.getTime() - 3600_000) return { state, say: P[lang].past };
  const slots = { ...state.slots, date: date!, time: time! };
  const to: Step = state.back ? "confirm" : "pax";
  const ns: FlowState = { ...state, slots, step: to, fails: 0, back: false };
  return { state: ns, say: to === "confirm" ? confirmText(slots, lang) : prompt("pax", lang) };
}

export function whenFailed(state: FlowState): Reply {
  const fails = state.fails + 1;
  if (fails >= MAX_FAILS) return { state: { ...state, fails }, say: P[state.lang].handoff, handoff: true };
  return { state: { ...state, fails }, say: P[state.lang].when2 };
}
