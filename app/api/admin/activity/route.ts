import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

async function requireAdmin() {
  const s = await getServerSession(authOptions);
  return (s?.user as { role?: string })?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const logs  = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
  return NextResponse.json(logs);
}

const logSchema = z.object({
  action:   z.string(),
  entity:   z.string(),
  entityId: z.string().optional(),
  details:  z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; name?: string } | undefined;
  const body    = logSchema.parse(await req.json());

  const log = await prisma.activityLog.create({
    data: {
      adminId:   user?.id,
      adminName: user?.name ?? "Admin",
      action:    body.action,
      entity:    body.entity,
      entityId:  body.entityId,
      details:   body.details as Prisma.InputJsonValue,
      ip:        req.headers.get("x-forwarded-for")?.split(",")[0],
    },
  });
  return NextResponse.json(log);
}
