import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, chatAudit } from "@/lib/chat-admin-auth";
import { adminRideInfo, adminThread } from "@/lib/chat-admin";
import { ChatRuleError, chatContext, sendChat, unreadCount } from "@/lib/chat";

export const dynamic = "force-dynamic";

const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

/** GET /api/admin/chat/:id: the whole thread (shared and private, each marked) and the ride beside it. ADMIN only. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ride = await adminRideInfo(id);
  if (!ride) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const thread = await adminThread(id, { after: sp.get("after"), before: sp.get("before"), limit: Number(sp.get("limit")) || undefined });
  // Opening a conversation is recorded (polling for new messages is not).
  if (!sp.get("after") && !sp.get("before")) await chatAudit(admin, "CHAT_VIEW", id, {}, ip(req));
  return NextResponse.json({ ride, ...thread, unread: await unreadCount(id, "ADMIN"), serverTime: new Date().toISOString() });
}

const body = z.object({
  clientId: z.string().trim().min(8).max(64),
  text: z.string().max(4000).optional(),
  attachmentId: z.string().trim().max(64).optional(),
  /** SHARED: everyone on the ride sees it. PRIVATE: only `to` sees it. */
  scope: z.enum(["SHARED", "PRIVATE"]),
  to: z.enum(["CUSTOMER", "DRIVER"]).optional(),
});

/** POST /api/admin/chat/:id: send as the office. A private message names who it is for. ADMIN only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const ctx = await chatContext(id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const out = await sendChat(ctx, "ADMIN", { ...parsed.data, adminUserId: admin.id, adminName: admin.name });
    if (!out.duplicate) {
      await chatAudit(
        admin,
        parsed.data.scope === "PRIVATE" ? "CHAT_SEND_PRIVATE" : "CHAT_SEND_SHARED",
        id,
        { messageId: out.message.id, to: parsed.data.scope === "PRIVATE" ? parsed.data.to : "everyone", hasPhoto: !!parsed.data.attachmentId },
        ip(req),
      );
    }
    const withParty = out.message.private ? (parsed.data.to === "DRIVER" ? "driver" : "customer") : null;
    return NextResponse.json({ message: { ...out.message, withParty, adminUserId: admin.id }, duplicate: out.duplicate }, { status: out.duplicate ? 200 : 201 });
  } catch (e) {
    if (e instanceof ChatRuleError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "CLOSED" ? 409 : 422 });
    throw e;
  }
}
