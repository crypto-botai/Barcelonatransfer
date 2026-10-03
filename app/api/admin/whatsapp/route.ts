import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadConversations } from "@/lib/whatsapp-inbox-store";
import { whatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** The inbox: one line per customer, with what is unread. Admin only. */
export async function GET() {
  const s = await getServerSession(authOptions);
  if ((s?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    conversations: await loadConversations(),
    // Booleans only, never the values: this is what the screen reads to say
    // why nothing is arriving.
    setup: {
      sending: whatsappConfigured(),
      receiving: Boolean(process.env.WA_VERIFY_TOKEN && process.env.WA_APP_SECRET),
    },
  });
}
