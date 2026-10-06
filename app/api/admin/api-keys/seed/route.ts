import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { seedKeysFromEnv } from "@/lib/ai/dbKeyManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  // ADMIN only. A signed-in customer is not enough: anyone can register one.
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await seedKeysFromEnv();
  return NextResponse.json({ ok: true, ...result });
}
