import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/chat-admin-auth";
import { markChatRead } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** POST /api/admin/chat/:id/read: this admin has seen everything so far. ADMIN only. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await markChatRead((await params).id, "ADMIN");
  return NextResponse.json({ read: true });
}
