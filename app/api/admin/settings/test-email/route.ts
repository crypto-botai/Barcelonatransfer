import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { COMPANY } from "@/lib/company-facts";
import { emailDocument, adminNoticeCard } from "@/lib/email/premium";

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const to = process.env.ADMIN_EMAIL ?? COMPANY.email;

  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>",
      to,
      subject: "✓ Email Test — Elite BCN Admin",
      html: emailDocument(
        adminNoticeCard({
          eyebrow: "Diagnostics",
          title: "Email is working",
          body: "This was sent from the admin settings page. If you are reading it, delivery, authentication and templating are all in order.",
          ctaUrl: "https://www.elitebcn.info/admin/settings",
          ctaText: "Back to settings",
        }),
        "Delivery, authentication and templating are all in order.",
      ),
    });

    if (result?.error) {
      return NextResponse.json({
        ok: false,
        error: result.error.message ?? "Resend rejected the email",
        detail: result.error,
        hint: "Domain 'elitebcn.info' must be verified in Resend dashboard → Domains. Add the required DNS records to your domain registrar.",
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: result?.data?.id, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
