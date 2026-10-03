import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { getWhatsAppConnection, subscribeWhatsAppApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Whether Meta is passing customers' messages on to this site. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await getWhatsAppConnection();
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: 502 });
  return NextResponse.json({ subscribed: c.subscribed, apps: c.apps });
}

/** Connect the business account to this site, then report the result. */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const done = await subscribeWhatsAppApp();
  if (!done.ok) return NextResponse.json({ error: done.reason }, { status: 502 });
  const c = await getWhatsAppConnection();
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: 502 });
  return NextResponse.json({ subscribed: c.subscribed, apps: c.apps });
}
