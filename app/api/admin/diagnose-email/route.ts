import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company-facts";
import { sendNewLeadAlert } from "@/lib/resend";
import { senderAddress, senderIsMisconfigured } from "@/lib/sender";

export const dynamic = "force-dynamic";

/**
 * Where a lead alert would actually go, and whether it gets there.
 *
 * "Am I still not getting leads?" cannot be answered from the code, because
 * the address is an environment variable and an environment variable set in
 * the Vercel dashboard beats the one committed to the repository. Nobody can
 * see which won by reading either.
 *
 * So this reports the values the running process actually holds, and then —
 * with ?send=1 — sends a real alert down the same function a real lead uses.
 * If the email arrives, the whole path works and the address on screen is
 * where leads land. If it does not, the log rows below say whether Resend
 * refused it or it was never attempted.
 *
 * It never prints a secret. The API key is reported as present or absent.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Sign in as an admin first, then open this link again." }, { status: 401 });
  }

  const effectiveAdminEmail = process.env.ADMIN_EMAIL ?? COMPANY.email;
  const effectiveFrom = senderAddress();
  const fromMisconfigured = senderIsMisconfigured();

  // The last few of each, so a failure is visible with its reason.
  const recent = await prisma.emailLog.findMany({
    where: { type: { in: ["ADMIN_LEAD", "ADMIN_ALERT", "FAILED"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { to: true, subject: true, type: true, status: true, createdAt: true },
  });

  const config = {
    adminEmail: effectiveAdminEmail,
    adminEmailFrom: process.env.ADMIN_EMAIL ? "environment variable" : "code default",
    from: effectiveFrom,
    // Never echo the value. It was a secret the one time this mattered.
    fromVariable: fromMisconfigured
      ? "RESEND_FROM is set to something that is not an email address and is being ignored — check it in the hosting dashboard"
      : process.env.RESEND_FROM ? "environment variable" : "code default",
    resendKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    contactEmail: COMPANY.email,
    siteUrl: process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info",
  };

  if (req.nextUrl.searchParams.get("send") !== "1") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      config,
      note: config.adminEmail === "booking@elitebcn.info"
        ? "Lead alerts are addressed to booking@elitebcn.info."
        : `Lead alerts are addressed to ${config.adminEmail}. If that is not what you want, change ADMIN_EMAIL in the Vercel dashboard — it overrides the code.`,
      recentAlertLog: recent,
      next: "Open this link again with ?send=1 to send a real lead alert down the same path a customer's would take.",
    });
  }

  // The real function, not a copy of it. A test that takes a different route
  // through the code proves nothing about the route that matters.
  const sessionId = `diagnostic-${Date.now()}`;
  try {
    await sendNewLeadAlert({
      name:  "Diagnostic Test Lead",
      email: effectiveAdminEmail,
      phone: "+34600000000",
      pickup:  "Terminal 1, Barcelona El Prat Airport BCN",
      dropoff: "Hotel Arts Barcelona",
      when:    "2027-06-15 10:00",
      passengers: 2,
      sessionId,
    });
    return NextResponse.json({
      ok: true,
      sent: true,
      to: effectiveAdminEmail,
      config,
      note: `Sent. Look for "New lead — Diagnostic Test Lead · +34600000000" at ${effectiveAdminEmail}. If it does not arrive within a minute or two, the log row for "LEAD ${sessionId}" will say why.`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      sent: false,
      to: effectiveAdminEmail,
      config,
      error: e instanceof Error ? e.message : String(e),
      note: "Resend refused the send. The message above is what it said.",
    }, { status: 502 });
  }
}
