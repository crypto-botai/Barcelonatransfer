/**
 * Groups: saved lists of customers the office can write to together.
 *
 * These are lists inside the admin, not WhatsApp group chats. A real WhatsApp
 * group would put customers' numbers in front of each other, which is a privacy
 * problem for a transfer company. A list sends each person the same message
 * privately, and they see only their own conversation.
 *
 * The one rule that keeps this from being spam: a message goes only to a member
 * who has written to us in the last 24 hours, because that is the only time
 * WhatsApp allows free-form text. Members outside that window are skipped and
 * reported, not messaged another way. Mass messages to people who have not
 * recently asked to hear from you are what gets a number blocked.
 *
 * Pure: no database and no network.
 */

import { toE164 } from "@/lib/phone";
import type { Conversation } from "@/lib/whatsapp-inbox";

export interface WaGroup {
  id: string;
  name: string;
  /** E.164 numbers. */
  members: string[];
}

export const GROUP_LIMITS = { groups: 20, members: 100, name: 40, text: 1000 } as const;

const slug = (v: unknown, fallback: string) =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;

export function sanitizeGroups(input: unknown): WaGroup[] {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: WaGroup[] = [];
  list.forEach((g: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const name = String(g?.name ?? "").replace(/\s+/g, " ").trim().slice(0, GROUP_LIMITS.name);
    if (!name) return;
    let id = slug(g?.id ?? name, `group-${i + 1}`);
    for (let n = 2; seen.has(id); n++) id = `${slug(g?.id ?? name, `group-${i + 1}`)}-${n}`;
    seen.add(id);
    const members = [...new Set((Array.isArray(g?.members) ? g.members : []).map((m: unknown) => toE164(String(m))).filter((m: string | null): m is string => Boolean(m)))] as string[];
    out.push({ id, name, members: members.slice(0, GROUP_LIMITS.members) });
  });
  return out.slice(0, GROUP_LIMITS.groups);
}

export interface BroadcastPlan {
  /** Members who can be written to now. */
  eligible: string[];
  /** Members who cannot, with the reason in words. */
  skipped: { phone: string; reason: string }[];
}

/** Who a message to this group would reach right now. */
export function planBroadcast(group: WaGroup, conversations: Pick<Conversation, "phone" | "windowOpen">[]): BroadcastPlan {
  const byPhone = new Map(conversations.map((c) => [c.phone, c]));
  const plan: BroadcastPlan = { eligible: [], skipped: [] };
  for (const phone of group.members) {
    const c = byPhone.get(phone);
    if (!c) plan.skipped.push({ phone, reason: "has not written to us" });
    else if (!c.windowOpen) plan.skipped.push({ phone, reason: "last wrote more than 24 hours ago" });
    else plan.eligible.push(phone);
  }
  return plan;
}
