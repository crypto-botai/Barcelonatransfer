import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listNotifications, markAllRead, markRead } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await listNotifications(userId);
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.read).length,
  });
}

/** Body: `{ all: true }` or `{ id: "<notificationId>" }`. */
export async function PATCH(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { all?: boolean; id?: string };

  if (body.all) {
    const count = await markAllRead(userId);
    return NextResponse.json({ ok: true, count });
  }

  if (typeof body.id === "string" && body.id) {
    // markRead scopes the update by userId, so a forged id belonging to another
    // customer simply matches nothing and returns false.
    const ok = await markRead(userId, body.id);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }

  return NextResponse.json({ error: "Provide { all: true } or { id }" }, { status: 400 });
}
