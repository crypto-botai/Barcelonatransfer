import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { loadGroups, recordBroadcast, sentRecently } from "@/lib/whatsapp-groups-store";
import { GROUP_LIMITS, planBroadcast } from "@/lib/whatsapp-groups";
import { loadConversations, recordOutbound } from "@/lib/whatsapp-inbox-store";
import { sendWhatsAppTextResult } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({ text: z.string().trim().min(1).max(GROUP_LIMITS.text) });

/**
 * Write to everyone in a group who can be written to now.
 *
 * Only members who messaged us in the last 24 hours are sent to, because that
 * is when WhatsApp allows free text and when a reply is welcome. The rest are
 * listed, with why, and left alone. Each message goes privately to one person
 * and appears in their own conversation.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 422 });
  const text = parsed.data.text;

  const { id } = await params;
  const group = (await loadGroups()).find((g) => g.id === id);
  if (!group) return NextResponse.json({ error: "That group does not exist." }, { status: 404 });
  if (group.members.length === 0) return NextResponse.json({ error: "This group has no members yet." }, { status: 422 });

  if (await sentRecently(group.id, text)) {
    return NextResponse.json({ error: "That exact message was just sent to this group. Wait a few minutes, or change it." }, { status: 409 });
  }

  const plan = planBroadcast(group, await loadConversations({ withBookings: false }));
  if (plan.eligible.length === 0) {
    return NextResponse.json(
      { error: "Nobody in this group has written to you in the last 24 hours, so WhatsApp will not allow a message to them now.", skipped: plan.skipped },
      { status: 409 },
    );
  }

  let sent = 0;
  const skipped = [...plan.skipped];
  for (const phone of plan.eligible) {
    const r = await sendWhatsAppTextResult(phone, text);
    if (r.outcome === "sent" && r.id) {
      sent++;
      await recordOutbound({ phone, wamid: r.id, text, by: `Group: ${group.name}` }).catch(() => {});
    } else {
      skipped.push({ phone, reason: r.reason ?? "WhatsApp did not accept it" });
    }
  }

  await recordBroadcast(group.id, text, user.name, sent);
  return NextResponse.json({ ok: true, sent, skipped });
}
