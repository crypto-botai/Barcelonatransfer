/**
 * Learning API — admin-only.
 *
 * GET  /api/ai/learning          — agent observations + pending proposals
 * POST /api/ai/learning          — trigger a manual review for a specific agent
 *                                  body: { agentName: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLearningDashboardData, runDailyReview } from "@/lib/ai/learning";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getLearningDashboardData();
  return NextResponse.json(data);
}

const postSchema = z.object({
  agentName: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Run asynchronously — don't block the response
  runDailyReview(body.data.agentName).catch(console.error);

  return NextResponse.json({ queued: true, agentName: body.data.agentName });
}
