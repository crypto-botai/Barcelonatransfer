import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingAgent }   from "@/lib/ai/agents/booking";
import { HealthAgent }    from "@/lib/ai/agents/health";
import { SeoAgent }       from "@/lib/ai/agents/seo";
import { AnalyticsAgent } from "@/lib/ai/agents/analytics";
import { MarketingAgent } from "@/lib/ai/agents/marketing";
import { KnowledgeAgent } from "@/lib/ai/agents/knowledge";

export const maxDuration = 55; // Vercel Hobby max 60s

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  return session && user?.role === "ADMIN";
}

// ── Agent registry ─────────────────────────────────────────────
// Add new agents here to expose them to the admin dashboard.
// Order determines run order when agentName = "all".
const AGENTS: Record<string, { run(): Promise<void> }> = {
  health:    new HealthAgent(),      // checks site uptime + page speed
  analytics: new AnalyticsAgent(),   // revenue + conversion insights
  booking:   new BookingAgent(),     // processes + scores new bookings
  knowledge: new KnowledgeAgent(),   // mines chat logs for KB updates
  marketing: new MarketingAgent(),   // drafts content to approval queue
  seo:       new SeoAgent(),         // meta-tag + SEO audit
};

// POST /api/ai/run  { agentName: "health" | "all" }
export async function POST(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body      = await req.json().catch(() => ({}));
  const agentName = String(body.agentName ?? "").toLowerCase().trim();

  // ── Run ALL agents sequentially ────────────────────────────────
  if (agentName === "all") {
    const results: Record<string, { ok: boolean; durationMs: number; error?: string }> = {};
    for (const [name, agent] of Object.entries(AGENTS)) {
      const t0 = Date.now();
      try {
        await agent.run();
        results[name] = { ok: true, durationMs: Date.now() - t0 };
      } catch (err) {
        results[name] = {
          ok: false,
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    return NextResponse.json({ ok: true, agentName: "all", results });
  }

  // ── Run single agent ───────────────────────────────────────────
  if (!AGENTS[agentName]) {
    return NextResponse.json(
      { error: `Unknown agent: "${agentName}". Valid: ${Object.keys(AGENTS).join(", ")}, all` },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  try {
    await AGENTS[agentName].run();
    return NextResponse.json({ ok: true, agentName, durationMs: Date.now() - t0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, agentName, error: msg, durationMs: Date.now() - t0 }, { status: 500 });
  }
}

// PATCH /api/ai/run — reset ERROR / WARNING agents back to IDLE
// Called by the "Reset Errors" button in the HQ dashboard.
export async function PATCH(req: NextRequest) {
  if (!(await adminOnly())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await prisma.aiAgent.updateMany({
    where: { status: { in: ["ERROR", "WARNING"] } },
    data:  { status: "IDLE", lastError: null },
  });

  return NextResponse.json({ ok: true, reset: count });
}
