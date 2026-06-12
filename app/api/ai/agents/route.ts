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

export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const agents = await prisma.aiAgent.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ agents });
}

const toggleSchema = z.object({
  id:        z.string(),
  isEnabled: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = toggleSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const agent = await prisma.aiAgent.update({
    where: { id: body.data.id },
    data:  { isEnabled: body.data.isEnabled, status: body.data.isEnabled ? "IDLE" : "OFFLINE" },
  });
  return NextResponse.json(agent);
}
