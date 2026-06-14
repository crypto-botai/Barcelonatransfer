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

const createSchema = z.object({
  category: z.string().min(1).max(50),
  question: z.string().min(3).max(300),
  answer:   z.string().min(5).max(3000),
  language: z.string().default("en"),
  tags:     z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const language = searchParams.get("language") ?? undefined;
  const q        = searchParams.get("q") ?? undefined;

  const entries = await prisma.knowledgeBase.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(language ? { language } : {}),
      ...(q ? { OR: [
        { question: { contains: q, mode: "insensitive" } },
        { answer:   { contains: q, mode: "insensitive" } },
      ]} : {}),
    },
    orderBy: [{ category: "asc" }, { usageCount: "desc" }],
    take: 200,
  });

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: body.error.errors[0].message }, { status: 400 });

  const entry = await prisma.knowledgeBase.create({ data: body.data });
  return NextResponse.json(entry, { status: 201 });
}
