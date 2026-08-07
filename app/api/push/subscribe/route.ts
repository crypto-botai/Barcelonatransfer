import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPushConfigured } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth:   z.string().min(1).max(255),
  }),
});

/** Registers this browser for push. Requires a session — pushes are per-account. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const { endpoint, keys } = parsed.data;

  // Endpoint is unique. Upserting means re-subscribing on the same device
  // updates the existing row instead of accumulating duplicates, and re-points
  // it at the current user if the device changed hands.
  await prisma.pushSubscription.upsert({
    where:  { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, lastUsedAt: new Date() },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth:   keys.auth,
      userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Unregisters this browser. Body: `{ endpoint }`. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  // Scoped by userId so one account cannot unsubscribe another's device.
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId } });
  return NextResponse.json({ ok: true });
}
