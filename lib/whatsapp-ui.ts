/**
 * The small pieces of logic behind the inbox screen, kept out of the components
 * so they can be tested: what a chat preview says, how a time is written, how
 * a message's text is split into plain words, links and WhatsApp's *bold*,
 * _italic_ and ~struck~ marks, and which saved replies match what is typed.
 */

import type { QuickReply } from "@/lib/whatsapp-settings";

const ZONE = "Europe/Madrid";

/** The line shown under a customer's name in the list. Media gets a word, not its internal label. */
export function previewText(type: string, text: string): string {
  const caption = text.replace(/^\[[a-z ]+\]\s*/i, "").trim();
  switch (type) {
    case "image": return caption ? `Photo · ${caption}` : "Photo";
    case "video": return caption ? `Video · ${caption}` : "Video";
    case "audio": return text.startsWith("[voice]") ? "Voice message" : "Audio";
    case "document": return caption ? `Document · ${caption}` : "Document";
    case "sticker": return "Sticker";
    case "location": return "Location";
    default: return text.replace(/\s+/g, " ").trim();
  }
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: ZONE });

/** The Barcelona calendar day of a moment, for deciding where a date divider goes. */
export function dayOf(iso: string): string {
  return dayKey(new Date(iso));
}

/** "14:05" in Barcelona time, whatever the viewer's clock says. */
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });
}

/** Today, Yesterday, a weekday inside the last week, otherwise the date. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((new Date(dayKey(now)).getTime() - new Date(dayKey(d)).getTime()) / 86400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long", timeZone: ZONE });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric", timeZone: ZONE });
}

/** The time for today, the day name otherwise: what the right edge of a list row shows. */
export function listStamp(iso: string, now: Date = new Date()): string {
  return dayLabel(iso, now) === "Today" ? clockTime(iso) : dayLabel(iso, now);
}

/** How long a free reply is still possible, in the words the header shows. */
export function windowLeft(endsAt: string | null, now: Date = new Date()): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left to reply` : `${Math.max(m, 1)}m left to reply`;
}

/** Up to two letters for an avatar. A bare number gets a plain glyph rather than a digit. */
export function initials(name: string | null, phone: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0]?.toUpperCase() ?? "").join("");
  return letters && /\p{L}/u.test(letters) ? letters : phone.replace(/\D/g, "").slice(-2) || "?";
}

/** A stable hue per customer so each avatar keeps its colour from one visit to the next. */
export function avatarHue(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// ─── Message text ────────────────────────────────────────────────────────────

export type Span =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "bold" | "italic" | "strike"; text: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/gi;

/**
 * Split a message into what to draw.
 *
 * Only http and https become links, and only those, so a message can never
 * smuggle a javascript: address into a clickable. The marks follow WhatsApp's
 * rules: they must hug their text (no space just inside), and cannot cross a
 * line, so "2 * 3 * 4" is arithmetic and not bold.
 */
export function formatSpans(text: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push(...marks(text.slice(last, m.index)));
    out.push({ kind: "link", text: m[0], href: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...marks(text.slice(last)));
  return out;
}

const MARK_RE = /(^|[\s(])([*_~])(?=\S)([^*_~\n]*?\S)\2(?=$|[\s).,;:!?])/g;
const KINDS = { "*": "bold", _: "italic", "~": "strike" } as const;

function marks(text: string): Span[] {
  const out: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK_RE)) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ kind: "text", text: text.slice(last, start) });
    out.push({ kind: KINDS[m[2] as keyof typeof KINDS], text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

// ─── Saved replies ───────────────────────────────────────────────────────────

/**
 * The saved replies to offer for what is typed. A leading slash opens the
 * picker; whatever follows narrows it. Anything else (including a slash in the
 * middle of a sentence, or a path like "/book") is left alone and sent as typed.
 */
export function matchQuickReplies(input: string, replies: QuickReply[]): QuickReply[] | null {
  const m = /^\/([a-z0-9-]{0,20})$/i.exec(input);
  if (!m) return null;
  const q = m[1].toLowerCase();
  if (!q) return replies.slice(0, 8);
  // The shortcut is what people type, so it ranks first. Searching the wording as well is a
  // convenience for three letters or more: with one or two, nearly every message matches.
  const starts = replies.filter((r) => r.shortcut.startsWith(q));
  const inName = replies.filter((r) => !r.shortcut.startsWith(q) && r.shortcut.includes(q));
  const inText = q.length >= 3 ? replies.filter((r) => !r.shortcut.includes(q) && r.text.toLowerCase().includes(q)) : [];
  return [...starts, ...inName, ...inText].slice(0, 8);
}

/** Does a customer's name, number or last message match what is typed in the search box? */
export function matchesSearch(c: { name: string | null; phone: string; lastText: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (c.name ?? "").toLowerCase().includes(q) ||
    c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "\u0000") ||
    c.lastText.toLowerCase().includes(q)
  );
}
