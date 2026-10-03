import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { getWhatsAppCatalog, setWhatsAppCatalog } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Whether the catalogue is switched on for the WhatsApp number. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await getWhatsAppCatalog();
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: 502 });
  return NextResponse.json(c.state);
}

const body = z.object({ visible: z.boolean() });

/** Switch the catalogue on (or off) for the number, then report where it stands. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Say whether to show the catalogue." }, { status: 422 });
  const done = await setWhatsAppCatalog(parsed.data.visible);
  if (!done.ok) return NextResponse.json({ error: done.reason }, { status: 502 });
  const c = await getWhatsAppCatalog();
  if (!c.ok) return NextResponse.json({ error: c.reason }, { status: 502 });
  return NextResponse.json(c.state);
}
