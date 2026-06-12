import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

const updateSchema = z.object({
  category: z.string().min(1).max(50).optional(),
  question: z.string().min(3).max(300).optional(),
  answer:   z.string().min(5).max(3000).optional(),
  language: z.string().optional(),
  tags:     z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = updateSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.errors[0].message }, { status: 400 });

  const entry = await prisma.knowledgeBase
    .update({ where: { id: params.id }, data: body.data })
    .catch(() => null);

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.knowledgeBase.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
