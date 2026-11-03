import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The phone agent's calls, newest first: every question it asked, every answer it heard, and the answers it had collected when
 * the call ended. Read-only, admin only.
 */
export async function GET() {
  const s = await getServerSession(authOptions);
  if ((s?.user as { role?: string })?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.activityLog.findMany({
    where: { action: { in: ["VOICE_TURN", "VOICE_STATE"] } },
    orderBy: { createdAt: "desc" },
    take: 600,
    select: { action: true, createdAt: true, details: true },
  });

  type Call = { callSid: string; startedAt: Date; transcript: { at: Date; who: string; text: string }[]; collected: unknown; step?: string };
  const calls = new Map<string, Call>();
  for (const r of [...rows].reverse()) {
    const d = r.details as { callSid?: string; role?: string; content?: string; state?: { step?: string; slots?: unknown } } | null;
    if (!d?.callSid) continue;
    const c = calls.get(d.callSid) ?? { callSid: d.callSid, startedAt: r.createdAt, transcript: [], collected: {} };
    if (r.action === "VOICE_TURN") c.transcript.push({ at: r.createdAt, who: d.role === "assistant" ? "agent" : "caller", text: d.content ?? "" });
    else if (d.state) { c.collected = d.state.slots ?? {}; c.step = d.state.step; }
    calls.set(d.callSid, c);
  }
  return NextResponse.json([...calls.values()].reverse().slice(0, 30));
}
