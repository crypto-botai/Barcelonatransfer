import { NextRequest, NextResponse } from "next/server";
import { runFollowUp } from "@/lib/whatsapp-followup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Answers customers nobody has replied to, when the office has switched that on.
 * Runs every five minutes. Vercel calls it with GET and the cron secret.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runFollowUp());
}

export const GET = handle;
export const POST = handle;
