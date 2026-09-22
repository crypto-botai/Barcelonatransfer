import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/ai/agents/orchestrator";
import { runAllAgentReviews } from "@/lib/ai/learning";
import { sweepFlightDelays } from "@/lib/flights/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// AI agents, several model calls per run. 60 was the Hobby ceiling.
export const maxDuration = 300;

function authorise(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "elite-cron-secret";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runOrchestrator();
  // Run learning reviews after agents complete so insights are based on today's data
  await runAllAgentReviews().catch(() => {});
  // Flight delays are also swept here, as a backstop. The pickup-reminder
  // entry sweeps them hourly, which is where freshness actually comes from;
  // this call costs nothing when there is nothing to find.
  await sweepFlightDelays(36).catch(() => null);

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
