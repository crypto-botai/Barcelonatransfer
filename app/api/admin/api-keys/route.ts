import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKeyHealthSnapshot, addKey, testRawKey } from "@/lib/ai/dbKeyManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return !!session?.user;
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await getKeyHealthSnapshot();
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { provider, label, rawKey, assignedAgent = "pool", skipTest = false } = body;

  if (!provider || !label || !rawKey) {
    return NextResponse.json({ error: "provider, label, rawKey are required" }, { status: 400 });
  }

  if (!skipTest) {
    const test = await testRawKey(provider, rawKey);
    if (!test.ok) {
      return NextResponse.json({ error: `Key validation failed: ${test.error}`, latencyMs: test.latencyMs }, { status: 422 });
    }
  }

  const id = await addKey({ provider, label, rawKey, assignedAgent });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
