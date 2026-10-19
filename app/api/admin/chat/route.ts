import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/chat-admin-auth";
import { listConversations, type AdminChatFilter } from "@/lib/chat-admin";

export const dynamic = "force-dynamic";

const FILTERS = new Set(["all", "active", "unread", "completed", "support"]);

/** GET /api/admin/chat?q=&filter=: the conversation list. ADMIN only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const f = sp.get("filter") ?? "all";
  const conversations = await listConversations({ q: sp.get("q") ?? "", filter: (FILTERS.has(f) ? f : "all") as AdminChatFilter });
  return NextResponse.json({ conversations });
}
