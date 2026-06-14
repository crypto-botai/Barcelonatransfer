import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function adminOnly() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isReadParam = searchParams.get("isRead");
  const severity    = searchParams.get("severity") ?? undefined;
  const limit       = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  const unreadOnly = isReadParam === "false" || searchParams.get("unread") === "true";

  const alerts = await prisma.aiAlert.findMany({
    where: {
      ...(unreadOnly ? { isRead: false, isDismissed: false } : { isDismissed: false }),
      ...(severity ? { severity: severity as "INFO" | "WARNING" | "CRITICAL" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { agent: { select: { name: true } } },
  });

  return NextResponse.json({ alerts });
}

// Mark alert(s) as read / dismissed
export async function PATCH(req: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    id?: string;
    ids?: string[];
    action?: "read" | "dismiss" | "read_all";
  };

  if (body.action === "read_all") {
    await prisma.aiAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
    return NextResponse.json({ ok: true });
  }

  const ids = body.ids ?? (body.id ? [body.id] : []);
  if (!ids.length) return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

  const data = body.action === "dismiss"
    ? { isDismissed: true }
    : { isRead: true };

  await prisma.aiAlert.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ ok: true });
}
