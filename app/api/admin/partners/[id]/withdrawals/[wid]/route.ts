import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** The office settling, or rejecting, a withdrawal a partner requested. */
const schema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "TRANSFERRED"]),
  notes:  z.string().optional(),
});

async function isAdmin() {
  const s = await getServerSession(authOptions);
  return Boolean(s && (s.user as { role?: string }).role === "ADMIN");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; wid: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, wid } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const w = await prisma.partnerWithdrawal.findFirst({ where: { id: wid, partnerId: id } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.partnerWithdrawal.update({
    where: { id: wid },
    data: { status: parsed.data.status, ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; wid: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, wid } = await params;
  // Rejecting a pending request returns the money to the available balance.
  await prisma.partnerWithdrawal.deleteMany({ where: { id: wid, partnerId: id, status: "PENDING" } });
  return NextResponse.json({ ok: true });
}
