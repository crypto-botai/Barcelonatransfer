import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resend } from "@/lib/resend";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await resend.emails.send({
    from: "Élite BCN Transfers <noreply@elitebcntransfers.com>",
    to: process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com",
    subject: "✓ Email Test — Élite BCN Admin",
    html: "<p>Your email system is working correctly.</p><p>This test was triggered from the admin settings page.</p>",
  });

  return NextResponse.json({ ok: true });
}
