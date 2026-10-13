import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { routingHealth } from "@/lib/geo/live-route";

export const dynamic = "force-dynamic";

/** GET /api/admin/routing-health: ADMIN only. Runs one real test route against the configured routing server and says if it is healthy. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string } | undefined)?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await routingHealth());
}
