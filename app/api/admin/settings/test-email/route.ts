import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resend } from "@/lib/resend";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const to = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";

  try {
    const result = await resend.emails.send({
      from: "Élite BCN Transfers <noreply@elitebcntransfers.com>",
      to,
      subject: "✓ Email Test — Élite BCN Admin",
      html: "<p>Your email system is working correctly.</p><p>This test was triggered from the admin settings page.</p>",
    });

    if (result?.error) {
      return NextResponse.json({
        ok: false,
        error: result.error.message ?? "Resend rejected the email",
        detail: result.error,
        hint: "Domain 'elitebcntransfers.com' must be verified in Resend dashboard → Domains. Add the required DNS records to your domain registrar.",
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: result?.data?.id, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
