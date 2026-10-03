import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toE164 } from "@/lib/phone";
import { loadThread, markSeen, recordOutbound } from "@/lib/whatsapp-inbox-store";
import { sendWhatsAppTextResult } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function admin() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string; name?: string | null } | undefined;
  return u?.role === "ADMIN" ? u : null;
}

function phoneFrom(raw: string): string | null {
  return toE164(decodeURIComponent(raw));
}

/** One customer's conversation, and which booking it is probably about. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });

  const { messages, canReplyFreely } = await loadThread(phone);
  const booking = await prisma.booking.findFirst({
    where: { guestPhone: phone, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, confirmationCode: true, status: true, guestName: true, pickupAddress: true, dropoffAddress: true, pickupDatetime: true },
  }).catch(() => null);

  return NextResponse.json({ phone, messages, canReplyFreely, booking });
}

/** The office has read it: clears the unread count. */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });
  await markSeen(phone);
  return NextResponse.json({ ok: true });
}

const reply = z.object({ text: z.string().trim().min(1).max(4000) });

/**
 * Answer a customer.
 *
 * Free text is only accepted by Meta inside 24 hours of the customer's last
 * message. Outside it the send would be refused, so it is refused here first,
 * with the reason, rather than appearing to go and then failing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });

  const parsed = reply.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 422 });

  const { canReplyFreely } = await loadThread(phone);
  if (!canReplyFreely) {
    return NextResponse.json(
      { error: "This customer last wrote more than 24 hours ago, so WhatsApp only accepts an approved template now. Ask them to message you first, or send the booking message from the booking page." },
      { status: 409 },
    );
  }

  const result = await sendWhatsAppTextResult(phone, parsed.data.text);
  if (result.outcome !== "sent" || !result.id) {
    return NextResponse.json({ error: result.reason ?? "WhatsApp did not accept the message." }, { status: 502 });
  }

  await recordOutbound({ phone, wamid: result.id, text: parsed.data.text, by: user.name ?? "Office" });
  return NextResponse.json({ ok: true, id: result.id });
}
