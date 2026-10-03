import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchWhatsAppMedia } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * A photo or document a customer sent, for the admin to view.
 *
 * Meta's file address needs the access token, so the browser cannot open it
 * directly; the server fetches it and passes it on. Admin only, and the token
 * never leaves the server.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getServerSession(authOptions);
  if ((s?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const file = await fetchWhatsAppMedia((await params).id);
  if (!file) return NextResponse.json({ error: "Not available" }, { status: 404 });
  return new NextResponse(file.bytes, {
    headers: {
      "Content-Type": file.contentType,
      // Never let a browser run what a stranger sent: shown or downloaded, not executed.
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'",
      "Cache-Control": "private, max-age=300",
    },
  });
}
