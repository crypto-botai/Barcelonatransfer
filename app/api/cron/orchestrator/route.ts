import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/ai/agents/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorise(req: NextRequest): boolean {
  const auth   = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "elite-cron-secret";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runOrchestrator();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
