import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

const CRON_SECRET = process.env.CRON_SECRET ?? "elite-cron-secret";

// Manual escape hatch for the "pricing" data-cache tag (see lib/pricing-service.ts).
// Normally only the admin pricing-edit API flushes this on save — but a direct DB
// write (e.g. re-running prisma/seed.ts) bypasses that route entirely, leaving the
// 1-hour unstable_cache serving stale prices until this is called or the TTL expires.
function authorise(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorise(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag("pricing", {});
  return NextResponse.json({ ok: true, revalidated: "pricing" });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
