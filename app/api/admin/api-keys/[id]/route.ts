import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ADMIN role only. "Signed in" is not enough: anyone can register a customer account. */
async function isAdmin(): Promise<boolean> {
  return !!(await requireAdmin());
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.label         !== undefined) patch.label         = body.label;
  if (body.assignedAgent !== undefined) patch.assignedAgent = body.assignedAgent;
  if (body.isEnabled     !== undefined) patch.isEnabled     = body.isEnabled;

  if (body.status === "live") {
    patch.status        = "live";
    patch.cooldownUntil = null;
    patch.lastError     = null;
  }

  const row = await prisma.adminApiKey.update({ where: { id }, data: patch });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.adminApiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
