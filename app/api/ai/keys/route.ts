/**
 * Key health API — admin-only.
 *
 * GET  /api/ai/keys        — list all tracked provider keys with health status
 * PATCH /api/ai/keys       — manually revive a dead/cooling key
 *                            body: { envKey: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKeyHealthSnapshot, reviveKey, liveKeyCount } from "@/lib/ai/keyManager";
import { getProviderInfo } from "@/lib/ai/providers";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  return session && user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot      = getKeyHealthSnapshot();
  const providerInfo  = getProviderInfo();
  const liveCount     = liveKeyCount();
  const total         = providerInfo.filter((p) => Boolean(process.env[p.envKey])).length;

  // Merge provider config with key health (enrich with agent assignments)
  const enriched = providerInfo.map((p) => {
    const health = snapshot.find((s) => s.envKey === p.envKey);
    return {
      agent:      p.agent,
      provider:   p.provider,
      model:      p.model,
      envKey:     p.envKey,
      configured: p.configured,
      status:     health?.status ?? (p.configured ? "live" : "unconfigured"),
      cooldownSec: health?.cooldownSec ?? 0,
      failureCount: health?.failureCount ?? 0,
      successCount: health?.successCount ?? 0,
      lastError:    health?.lastError ?? "",
      avgLatencyMs: health?.avgLatencyMs ?? 0,
      lastUsedAt:   health?.lastUsedAt ?? 0,
    };
  });

  return NextResponse.json({
    providers: enriched,
    summary: {
      total,
      live:  liveCount,
      cooling: snapshot.filter((s) => s.status === "cooling").length,
      dead:    snapshot.filter((s) => s.status === "dead").length,
    },
  });
}

const patchSchema = z.object({
  envKey: z.string().min(1).max(100),
});

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const revived = reviveKey(body.data.envKey);
  if (!revived) {
    return NextResponse.json({ error: "Key not found in health tracker (has not been used yet)" }, { status: 404 });
  }

  return NextResponse.json({ revived: true, envKey: body.data.envKey });
}
