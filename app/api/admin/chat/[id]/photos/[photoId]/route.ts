import { NextResponse } from "next/server";
import { requireAdmin, chatAudit } from "@/lib/chat-admin-auth";
import { readAttachment } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** GET: the photo itself, for an <img>. ADMIN only. Opening one is recorded. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, photoId } = await params;
  const file = await readAttachment(id, photoId, "ADMIN");
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await chatAudit(admin, "CHAT_PHOTO_VIEW", id, { photoId });
  return new NextResponse(Buffer.from(file.data), { headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
