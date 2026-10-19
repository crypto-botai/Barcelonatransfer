import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/chat-admin-auth";
import { ChatRuleError, saveAttachment } from "@/lib/chat";

export const dynamic = "force-dynamic";

const body = z.object({ data: z.string().min(16).max(2_200_000) });

/** POST /api/admin/chat/:id/photos { data: base64 }: store a photo to attach to an office message. ADMIN only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    return NextResponse.json({ attachmentId: await saveAttachment((await params).id, "ADMIN", parsed.data.data) }, { status: 201 });
  } catch (e) {
    if (e instanceof ChatRuleError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
    throw e;
  }
}
