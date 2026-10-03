import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { prisma } from "@/lib/prisma";
import { toE164 } from "@/lib/phone";
import { inboxRevision, loadThread, markSeen, recordFlag, recordOutbound, recordOutboundReaction } from "@/lib/whatsapp-inbox-store";
import {
  markWhatsAppRead, sendWhatsAppInteractive, sendWhatsAppReaction, sendWhatsAppTextResult,
} from "@/lib/whatsapp";
import { loadSettings } from "@/lib/whatsapp-settings-store";
import { buildCatalogMessage, buildServiceLink, buildServicesMenu, resolveServices } from "@/lib/whatsapp-services";

export const dynamic = "force-dynamic";

function phoneFrom(raw: string): string | null {
  return toE164(decodeURIComponent(raw));
}

/** One customer's conversation, and which booking it is probably about. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });

  const rev = await inboxRevision(phone);
  if (req.nextUrl.searchParams.get("rev") === rev) return NextResponse.json({ unchanged: true, rev });

  const { messages, canReplyFreely, windowEndsAt } = await loadThread(phone);
  const booking = await prisma.booking.findFirst({
    where: { guestPhone: phone, isDeleted: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, confirmationCode: true, status: true, guestName: true, pickupAddress: true, dropoffAddress: true, pickupDatetime: true },
  }).catch(() => null);

  return NextResponse.json({ rev, phone, messages, canReplyFreely, windowEndsAt, booking });
}

/**
 * The office has read it: clears the unread count, and tells the customer by
 * turning their ticks blue.
 */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });
  const cleared = await markSeen(phone);
  if (cleared) await markWhatsAppRead(cleared);
  return NextResponse.json({ ok: true });
}

/** "auto" hands the tag back to the booking. */
const flags = z
  .object({ favorite: z.boolean().optional(), unread: z.boolean().optional(), tag: z.enum(["pending", "deposit", "cash", "paid", "cancelled", "auto"]).optional() })
  .refine((v) => v.favorite !== undefined || v.unread !== undefined || v.tag !== undefined);

/** Star a conversation, keep it as unread so it is not forgotten, or tag where the payment stands. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });
  const parsed = flags.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to change." }, { status: 422 });
  if (parsed.data.favorite !== undefined) await recordFlag(phone, "favorite", parsed.data.favorite);
  // Only "keep as unread" is stored: opening the chat is what clears it, and that is already recorded.
  if (parsed.data.unread === true) await recordFlag(phone, "unread", true);
  if (parsed.data.tag !== undefined) await recordFlag(phone, "tag", parsed.data.tag === "auto" ? null : parsed.data.tag);
  return NextResponse.json({ ok: true });
}

const body = z.union([
  z.object({ text: z.string().trim().min(1).max(4000), replyTo: z.string().max(200).nullish() }),
  z.object({ reaction: z.object({ wamid: z.string().min(1).max(200), emoji: z.string().max(16) }) }),
  z.object({ menu: z.literal(true) }),
  z.object({ catalog: z.literal(true) }),
  z.object({ service: z.string().min(1).max(60) }),
]);

const WINDOW_CLOSED =
  "This customer last wrote more than 24 hours ago, so WhatsApp only accepts an approved template now. Ask them to message you first, or send the booking message from the booking page.";

/**
 * Answer a customer: a message, a reaction, the services menu or one service.
 *
 * Free-form WhatsApp is only accepted by Meta inside 24 hours of the customer's
 * last message. Outside it the send would be refused, so it is refused here first,
 * with the reason, rather than appearing to go and then failing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const phone = phoneFrom((await params).phone);
  if (!phone) return NextResponse.json({ error: "Not a phone number" }, { status: 422 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 422 });
  const b = parsed.data;

  const { canReplyFreely } = await loadThread(phone);
  if (!canReplyFreely) return NextResponse.json({ error: WINDOW_CLOSED }, { status: 409 });

  const fail = (reason?: string) => NextResponse.json({ error: reason ?? "WhatsApp did not accept the message." }, { status: 502 });

  if ("text" in b) {
    const result = await sendWhatsAppTextResult(phone, b.text, { replyTo: b.replyTo });
    if (result.outcome !== "sent" || !result.id) return fail(result.reason);
    await recordOutbound({ phone, wamid: result.id, text: b.text, by: user.name, replyTo: b.replyTo ?? null });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if ("reaction" in b) {
    const result = await sendWhatsAppReaction(phone, b.reaction.wamid, b.reaction.emoji);
    if (result.outcome !== "sent") return fail(result.reason);
    await recordOutboundReaction({ phone, wamid: b.reaction.wamid, emoji: b.reaction.emoji });
    return NextResponse.json({ ok: true });
  }

  const settings = await loadSettings();
  const services = await resolveServices(settings.services);

  if ("menu" in b) {
    const menu = buildServicesMenu(services);
    if (!menu) return NextResponse.json({ error: "No services are switched on. Turn some on in WhatsApp settings." }, { status: 422 });
    const result = await sendWhatsAppInteractive(phone, menu);
    if (result.outcome !== "sent" || !result.id) return fail(result.reason);
    await recordOutbound({ phone, wamid: result.id, by: user.name, text: "Services menu: airport and city transfers, Costa Brava, by the hour." });
    return NextResponse.json({ ok: true, id: result.id });
  }

  if ("catalog" in b) {
    const catalog = buildCatalogMessage(services);
    if (!catalog) return NextResponse.json({ error: "No services are switched on. Turn some on in WhatsApp settings." }, { status: 422 });
    const result = await sendWhatsAppInteractive(phone, catalog);
    if (result.outcome !== "sent" || !result.id) return fail(result.reason);
    await recordOutbound({ phone, wamid: result.id, by: user.name, text: "Catalogue: our services with prices." });
    return NextResponse.json({ ok: true, id: result.id });
  }

  const service = services.find((s) => s.id === b.service && s.enabled);
  if (!service) return NextResponse.json({ error: "That service is not available." }, { status: 404 });
  const result = await sendWhatsAppInteractive(phone, buildServiceLink(service));
  if (result.outcome !== "sent" || !result.id) return fail(result.reason);
  await recordOutbound({
    phone, wamid: result.id, by: user.name,
    text: `${service.title}: ${service.fromPrice ? `from €${service.fromPrice}` : "price on booking"}. Book: ${service.url}`,
  });
  return NextResponse.json({ ok: true, id: result.id });
}
