import { NextResponse } from "next/server";
import { isPushConfigured } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";

/** Whether push is set up on this deployment, and the public key a browser needs. It is public by design. */
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}
