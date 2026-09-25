import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRecoveredLeadsDigest } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The leads whose alert never arrived.
 *
 * Until today the alert was fired without being waited for, so on serverless
 * it usually died with the response and the office heard nothing. What it did
 * not lose is the lead itself: every one of those customers had already
 * written their name, email, phone and route into a bookingSession row before
 * the alert was even attempted. The data has been sitting there the whole
 * time; only the telling failed.
 *
 * This finds them — a session with a full set of contact details and no
 * ADMIN_LEAD entry in the email log — and sends them in one digest rather
 * than hundreds of separate emails.
 *
 * Opened with no query string it reports and sends nothing, because the first
 * thing anyone wants to know is how many there are. ?send=1 mails the digest
 * and writes the missing log rows, so a second run finds nothing and the
 * nightly job does not treat them as new.
 *
 * A one-off. Delete it once it has been used.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Sign in as an admin first, then open this link again." }, { status: 401 });
  }

  const send = req.nextUrl.searchParams.get("send") === "1";

  // A lead is a session somebody finished the contact step of. Without all
  // three there is nobody to ring.
  const sessions = await prisma.bookingSession.findMany({
    where: {
      email: { not: null },
      name:  { not: null },
      phone: { not: null },
    },
    orderBy: { lastActivity: "desc" },
    select: {
      sessionId: true, email: true, name: true, phone: true,
      formData: true, step: true, converted: true,
      lastActivity: true, createdAt: true,
    },
  });

  // One query for the log rather than one per session.
  const alerted = new Set(
    (await prisma.emailLog.findMany({
      where: { type: "ADMIN_LEAD" },
      select: { subject: true },
    })).map((r) => r.subject),
  );

  const missed = sessions.filter((s) => !alerted.has(`LEAD ${s.sessionId}`));

  const rows = missed.map((s) => {
    const fd = (s.formData ?? {}) as Record<string, unknown>;
    const str = (k: string) => { const v = fd[k]; return v == null || v === "" ? null : String(v); };
    const quoted = (fd.quote as { totalAmount?: number } | undefined)?.totalAmount ?? Number(fd.totalAmount);
    return {
      sessionId: s.sessionId,
      name:  s.name!,
      email: s.email!,
      phone: s.phone!,
      pickup:  str("pickupAddress"),
      dropoff: str("dropoffAddress"),
      when: str("date") ? `${str("date")}${str("time") ? ` ${str("time")}` : ""}` : null,
      passengers: str("passengers"),
      quoted: Number.isFinite(Number(quoted)) && Number(quoted) > 0 ? Number(quoted) : null,
      step: s.step,
      converted: s.converted,
      lastActivity: s.lastActivity,
    };
  });

  // Somebody who went on to book is not a lost lead.
  const stillOpen = rows.filter((r) => !r.converted);

  if (!send) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      totalSessionsWithContact: sessions.length,
      alreadyAlerted: sessions.length - missed.length,
      neverAlerted: missed.length,
      neverAlertedAndNotBooked: stillOpen.length,
      oldest: stillOpen.length ? stillOpen[stillOpen.length - 1].lastActivity : null,
      newest: stillOpen.length ? stillOpen[0].lastActivity : null,
      preview: stillOpen.slice(0, 5).map((r) => ({ name: r.name, phone: r.phone, when: r.when, pickup: r.pickup })),
      next: "Open this link again with ?send=1 to email the full list and mark them as told.",
    });
  }

  if (stillOpen.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "Nothing to recover." });
  }

  await sendRecoveredLeadsDigest(stillOpen);

  // Write the log rows the failed sends never wrote, so a second run finds
  // nothing and nothing downstream treats these as new.
  await prisma.emailLog.createMany({
    data: stillOpen.map((r) => ({
      to: process.env.ADMIN_EMAIL ?? "booking@elitebcn.info",
      subject: `LEAD ${r.sessionId}`,
      type: "ADMIN_LEAD",
      status: "SENT",
    })),
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent: true, count: stillOpen.length });
}
