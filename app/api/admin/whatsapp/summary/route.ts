import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { inboxRevision, loadSummary } from "@/lib/whatsapp-inbox-store";

export const dynamic = "force-dynamic";

/**
 * How many messages are waiting, and what the newest one said.
 *
 * Asked by every admin page, not only the inbox, because it drives the badge in
 * the sidebar and the desktop alert. Cheap when nothing has changed.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rev = await inboxRevision();
  if (req.nextUrl.searchParams.get("rev") === rev) return NextResponse.json({ unchanged: true, rev });
  return NextResponse.json({ rev, ...(await loadSummary()) });
}
