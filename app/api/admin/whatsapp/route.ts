import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { inboxRevision, loadConversations } from "@/lib/whatsapp-inbox-store";
import { whatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * The inbox: one line per customer, with what is unread. Admin only.
 *
 * Send back the `rev` from the last answer and, if nothing has happened since,
 * the reply is a few bytes instead of the whole inbox. The page asks every few
 * seconds, so that is most of the traffic this route will ever see.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rev = await inboxRevision();
  if (req.nextUrl.searchParams.get("rev") === rev) return NextResponse.json({ unchanged: true, rev });

  return NextResponse.json({
    rev,
    conversations: await loadConversations(),
    // Booleans only, never the values: this is what the screen reads to say
    // why nothing is arriving.
    setup: {
      sending: whatsappConfigured(),
      receiving: Boolean(process.env.WA_VERIFY_TOKEN && process.env.WA_APP_SECRET),
    },
  });
}
