import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.label         !== undefined) patch.label         = body.label;
  if (body.assignedAgent !== undefined) patch.assignedAgent = body.assignedAgent;
  if (body.isEnabled     !== undefined) patch.isEnabled     = body.isEnabled;

  // Explicit revive: reset cooling / dead back to live
  if (body.status === "live") {
    patch.status        = "live";
    patch.cooldownUntil = null;
    patch.lastError     = null;
  }

  const row = await prisma.adminApiKey.update({ where: { id: params.id }, data: patch });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.adminApiKey.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
