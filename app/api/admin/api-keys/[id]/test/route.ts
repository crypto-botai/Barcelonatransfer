import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey, testRawKey, markDbKeyFailed, markDbKeySuccess } from "@/lib/ai/dbKeyManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = await prisma.adminApiKey.findUnique({ where: { id: params.id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let rawKey: string;
  try {
    rawKey = decryptKey(key.encryptedKey);
  } catch {
    return NextResponse.json({ ok: false, error: "Decryption failed — check API_KEY_ENCRYPTION_SECRET" }, { status: 500 });
  }

  const result = await testRawKey(key.provider, rawKey);

  if (result.ok) {
    await markDbKeySuccess(params.id);
  } else {
    await markDbKeyFailed(params.id, result.error ?? "Test failed");
  }

  return NextResponse.json(result);
}
