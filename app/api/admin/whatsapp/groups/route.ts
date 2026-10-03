import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { loadGroups, saveGroups } from "@/lib/whatsapp-groups-store";

export const dynamic = "force-dynamic";

/** The saved lists of customers. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ groups: await loadGroups() });
}

/** Replace the lists. What comes back is what was really saved, cleaned. */
export async function PUT(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { groups?: unknown } | null;
  if (!body || !Array.isArray(body.groups)) return NextResponse.json({ error: "Nothing to save." }, { status: 422 });
  return NextResponse.json({ groups: await saveGroups(body.groups, user.name) });
}
