import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { BookingAgent }   from "@/lib/ai/agents/booking";
import { HealthAgent }    from "@/lib/ai/agents/health";
import { SeoAgent }       from "@/lib/ai/agents/seo";
import { AnalyticsAgent } from "@/lib/ai/agents/analytics";

export const maxDuration = 55; // Vercel Hobby: max 60s

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return session && user?.role === "ADMIN";
}

const AGENTS: Record<string, { run(): Promise<void> }> = {
  booking:   new BookingAgent(),
  health:    new HealthAgent(),
  seo:       new SeoAgent(),
  analytics: new AnalyticsAgent(),
};

// POST /api/ai/run  { agentName: "health" }
export async function POST(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const agentName = String(body.agentName ?? "").toLowerCase();

  if (!AGENTS[agentName]) {
    return NextResponse.json({ error: `Unknown agent: ${agentName}. Valid: ${Object.keys(AGENTS).join(", ")}` }, { status: 400 });
  }

  const start = Date.now();
  try {
    await AGENTS[agentName].run();
    return NextResponse.json({ ok: true, agentName, durationMs: Date.now() - start });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, agentName, error: msg, durationMs: Date.now() - start }, { status: 500 });
  }
}
