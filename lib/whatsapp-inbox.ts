/**
 * The WhatsApp inbox: what customers write to the UK number, and what the
 * office answers.
 *
 * Meta posts every inbound message and every delivery update to one webhook.
 * This turns those payloads into a conversation per customer, and works out the
 * things the office needs to know: who has written, whether it has been read,
 * and whether a free reply is still allowed.
 *
 * Storage is the existing activity log, one row per event, because adding a
 * table needs a database migration and none was available. The cost is that a
 * conversation list is built by reading recent rows and grouping them. At the
 * volume of a transfer business that is a few hundred rows and fine; if it ever
 * is not, this is the one file to move onto its own table.
 *
 * Row shapes (entity is always "WhatsApp", entityId is the customer's number in
 * E.164 form so every row for one conversation shares it):
 *   WA_MESSAGE  { dir: "in" | "out", wamid, text, type, mediaId?, name?, by? }
 *   WA_STATUS   { wamid, status, errorCode?, errorText? }
 *   WA_SEEN     {}                      the office opened the conversation
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { toE164 } from "@/lib/phone";

export const WA_ENTITY = "WhatsApp";

/** Meta only allows free text to a customer who wrote in the last 24 hours. */
export const SESSION_WINDOW_MS = 24 * 3600_000;

// ─── Webhook payloads ────────────────────────────────────────────────────────

export interface InboundMessage {
  wamid: string;
  /** E.164, with the plus. */
  phone: string;
  name: string | null;
  /** Unix seconds as Meta sends it, converted. */
  at: Date;
  type: string;
  text: string;
  mediaId: string | null;
}

export interface StatusUpdate {
  wamid: string;
  phone: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: Date;
  errorCode: string | null;
  errorText: string | null;
}

/** Meta's ids come without a plus: "34635383712". */
export function waPhone(id: string | null | undefined): string | null {
  const digits = String(id ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return toE164(`+${digits}`);
}

type Msg = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** The words a customer sent, or a label for what they sent instead. */
function describeMessage(m: Msg): { text: string; mediaId: string | null } {
  switch (m.type) {
    case "text":
      return { text: String(m.text?.body ?? ""), mediaId: null };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const node = m[m.type] ?? {};
      const label = `[${m.type}]`;
      const caption = node.caption ? ` ${node.caption}` : node.filename ? ` ${node.filename}` : "";
      return { text: `${label}${caption}`, mediaId: node.id ?? null };
    }
    case "location":
      return {
        text: `[location] ${m.location?.name ? `${m.location.name} ` : ""}https://www.google.com/maps?q=${m.location?.latitude},${m.location?.longitude}`,
        mediaId: null,
      };
    case "button":
      return { text: String(m.button?.text ?? "[button]"), mediaId: null };
    case "interactive":
      return {
        text: String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "[reply]"),
        mediaId: null,
      };
    case "reaction":
      return { text: `[reaction] ${m.reaction?.emoji ?? ""}`.trim(), mediaId: null };
    case "contacts":
      return { text: "[contact card]", mediaId: null };
    default:
      return { text: `[${m.type ?? "message"} not shown here]`, mediaId: null };
  }
}

/**
 * Everything usable in one webhook delivery.
 *
 * Tolerant by design: Meta changes this payload's shape and sends test events
 * with fields missing, and the webhook must answer 200 to all of them or Meta
 * retries and eventually disables it. Anything unreadable is skipped.
 */
export function parseWebhook(payload: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const out = { messages: [] as InboundMessage[], statuses: [] as StatusUpdate[] };
  const entries = (payload as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: Msg })?.value;
      if (!value || typeof value !== "object") continue;

      const names = new Map<string, string>();
      for (const c of Array.isArray(value.contacts) ? value.contacts : []) {
        if (c?.wa_id && c?.profile?.name) names.set(String(c.wa_id), String(c.profile.name));
      }

      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        const phone = waPhone(m?.from);
        if (!phone || !m?.id) continue;
        const { text, mediaId } = describeMessage(m);
        out.messages.push({
          wamid: String(m.id),
          phone,
          name: names.get(String(m.from)) ?? null,
          at: new Date(Number(m.timestamp) * 1000 || Date.now()),
          type: String(m.type ?? "text"),
          text,
          mediaId,
        });
      }

      for (const s of Array.isArray(value.statuses) ? value.statuses : []) {
        const phone = waPhone(s?.recipient_id);
        const status = s?.status;
        if (!phone || !s?.id || !["sent", "delivered", "read", "failed"].includes(status)) continue;
        const err = Array.isArray(s.errors) ? s.errors[0] : null;
        out.statuses.push({
          wamid: String(s.id),
          phone,
          status,
          at: new Date(Number(s.timestamp) * 1000 || Date.now()),
          errorCode: err?.code != null ? String(err.code) : null,
          errorText: err?.title ?? err?.message ?? null,
        });
      }
    }
  }
  return out;
}

// ─── Authenticity ────────────────────────────────────────────────────────────

/**
 * Meta signs the raw request body with the app secret (HMAC-SHA256) and sends
 * "sha256=<hex>" in X-Hub-Signature-256. Anything else is not Meta, and the
 * webhook is public, so it is refused. With no secret configured nothing can be
 * verified, and that is a refusal as well.
 */
export function validMetaSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ─── Conversations ───────────────────────────────────────────────────────────

export interface LogRow {
  action: string;
  entityId: string | null;
  createdAt: Date | string;
  details: unknown;
}

export interface ChatMessage {
  wamid: string;
  dir: "in" | "out";
  text: string;
  type: string;
  mediaId: string | null;
  at: string;
  by: string | null;
  /** For messages we sent: where it got to. */
  status: "sent" | "delivered" | "read" | "failed" | null;
  problem: string | null;
}

export interface Conversation {
  phone: string;
  name: string | null;
  lastText: string;
  lastAt: string;
  lastDir: "in" | "out";
  unread: number;
  /** Until when a free-text reply is allowed. Null when the customer has never written. */
  windowEndsAt: string | null;
  windowOpen: boolean;
}

const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

const time = (v: Date | string) => new Date(v).getTime();
const det = (r: LogRow) => (r.details ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** One customer's messages, oldest first, each with its delivery state. */
export function buildThread(rows: LogRow[]): ChatMessage[] {
  const status = new Map<string, { s: ChatMessage["status"]; problem: string | null }>();
  for (const r of rows) {
    if (r.action !== "WA_STATUS") continue;
    const d = det(r);
    if (!d.wamid || !d.status) continue;
    const prev = status.get(d.wamid);
    // A message only moves forward: read after delivered after sent. A failure
    // stands, because it can arrive after "sent" and is the thing to see.
    if (!prev || STATUS_RANK[d.status] > STATUS_RANK[prev.s ?? ""] || d.status === "failed") {
      status.set(d.wamid, { s: d.status, problem: d.status === "failed" ? (d.errorText ?? d.errorCode ?? "failed") : null });
    }
  }

  return rows
    .filter((r) => r.action === "WA_MESSAGE")
    .map((r): ChatMessage => {
      const d = det(r);
      const st = d.dir === "out" ? status.get(d.wamid) : undefined;
      return {
        wamid: String(d.wamid ?? ""),
        dir: d.dir === "out" ? "out" : "in",
        text: String(d.text ?? ""),
        type: String(d.type ?? "text"),
        mediaId: d.mediaId ?? null,
        at: new Date(r.createdAt).toISOString(),
        by: d.by ?? null,
        status: st?.s ?? null,
        problem: st?.problem ?? null,
      };
    })
    .sort((a, b) => time(a.at) - time(b.at));
}

/** The inbox: one line per customer, most recent first. */
export function buildConversations(rows: LogRow[], now: Date = new Date()): Conversation[] {
  const byPhone = new Map<string, LogRow[]>();
  for (const r of rows) {
    if (!r.entityId) continue;
    const list = byPhone.get(r.entityId);
    if (list) list.push(r); else byPhone.set(r.entityId, [r]);
  }

  const out: Conversation[] = [];
  for (const [phone, list] of byPhone) {
    const messages = list.filter((r) => r.action === "WA_MESSAGE");
    if (messages.length === 0) continue;
    messages.sort((a, b) => time(a.createdAt) - time(b.createdAt));

    const last = messages[messages.length - 1];
    const lastIn = [...messages].reverse().find((r) => det(r).dir === "in");
    const seen = list.filter((r) => r.action === "WA_SEEN").reduce((m, r) => Math.max(m, time(r.createdAt)), 0);
    const unread = messages.filter((r) => det(r).dir === "in" && time(r.createdAt) > seen).length;

    const windowEnds = lastIn ? time(lastIn.createdAt) + SESSION_WINDOW_MS : null;
    const name = [...messages].reverse().map((r) => det(r).name).find(Boolean) ?? null;

    out.push({
      phone,
      name,
      lastText: String(det(last).text ?? ""),
      lastAt: new Date(last.createdAt).toISOString(),
      lastDir: det(last).dir === "out" ? "out" : "in",
      unread,
      windowEndsAt: windowEnds ? new Date(windowEnds).toISOString() : null,
      windowOpen: windowEnds !== null && windowEnds > now.getTime(),
    });
  }
  return out.sort((a, b) => time(b.lastAt) - time(a.lastAt));
}

/** Can the office send free text to this customer right now? */
export function canReplyFreely(rows: LogRow[], now: Date = new Date()): boolean {
  const lastIn = rows
    .filter((r) => r.action === "WA_MESSAGE" && det(r).dir === "in")
    .reduce((m, r) => Math.max(m, time(r.createdAt)), 0);
  return lastIn > 0 && lastIn + SESSION_WINDOW_MS > now.getTime();
}
