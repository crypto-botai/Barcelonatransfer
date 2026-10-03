import { loadConversations, lastOutboundTimes, recordOutbound } from "@/lib/whatsapp-inbox-store";
import { loadSettings } from "@/lib/whatsapp-settings-store";
import { resolveServices } from "@/lib/whatsapp-services";
import { unansweredReply } from "@/lib/whatsapp-assistant";
import { sendWhatsAppTextResult } from "@/lib/whatsapp";
import { AUTO_REPLY_COOLDOWN_MS } from "@/lib/whatsapp-settings";
import type { Conversation } from "@/lib/whatsapp-inbox";

/**
 * Answer customers nobody has replied to.
 *
 * Runs every few minutes. A customer is answered when all of these hold:
 *   - their message is the last one in the chat (nobody has replied)
 *   - it has waited longer than the office chose in settings
 *   - it is inside WhatsApp's 24-hour window, when a free reply is allowed
 *   - they have not already had an automatic answer in the last 12 hours
 *
 * The last rule is what keeps it from becoming spam: however long the office
 * stays silent, a customer gets one automatic answer and not one every few
 * minutes. After that it is a person's turn.
 */

export const MAX_PER_RUN = 20;
/** A reply sent in the last minutes of the window can fail on the way, so those are left alone. */
const MIN_WINDOW_LEFT_MS = 5 * 60_000;

/** Conversations that have been waiting long enough for an answer, and are still answerable. */
export function followUpCandidates(conversations: Conversation[], now: Date, minutes: number): Conversation[] {
  return conversations.filter((c) => {
    if (c.lastDir !== "in" || !c.windowOpen || !c.windowEndsAt) return false;
    const waited = now.getTime() - new Date(c.lastAt).getTime();
    return waited >= minutes * 60_000 && new Date(c.windowEndsAt).getTime() - now.getTime() > MIN_WINDOW_LEFT_MS;
  });
}

export interface FollowUpResult { enabled: boolean; considered: number; sent: number; skipped: number }

export async function runFollowUp(now: Date = new Date()): Promise<FollowUpResult> {
  const settings = await loadSettings();
  const result: FollowUpResult = { enabled: settings.unanswered.enabled, considered: 0, sent: 0, skipped: 0 };
  if (!settings.unanswered.enabled) return result;

  const candidates = followUpCandidates(await loadConversations({ withBookings: false }), now, settings.unanswered.minutes);
  result.considered = candidates.length;
  if (candidates.length === 0) return result;

  const services = await resolveServices(settings.services);

  for (const c of candidates) {
    if (result.sent >= MAX_PER_RUN) { result.skipped++; continue; }

    // Once per twelve hours, whoever stays silent.
    const { lastAutoAt } = await lastOutboundTimes(c.phone);
    if (lastAutoAt && now.getTime() - lastAutoAt.getTime() < AUTO_REPLY_COOLDOWN_MS) { result.skipped++; continue; }

    const reply = unansweredReply({
      text: c.lastInText,
      type: c.lastType,
      assistant: settings.unanswered.assistant,
      holding: settings.unanswered.text,
      services,
    });

    const r = await sendWhatsAppTextResult(c.phone, reply.text);
    if (r.outcome === "sent" && r.id) {
      result.sent++;
      await recordOutbound({ phone: c.phone, wamid: r.id, text: reply.text, by: "Auto-reply" });
    } else {
      result.skipped++;
    }
  }
  return result;
}
