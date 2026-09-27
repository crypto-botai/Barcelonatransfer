import { NextRequest, NextResponse, after } from "next/server";
import { sweepAbandonedIfDue } from "@/lib/abandoned";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sendNewLeadAlert } from "@/lib/resend";
import { COMPANY } from "@/lib/company-facts";

const schema = z.object({
  sessionId: z.string().min(1),
  email:     z.string().email().optional(),
  name:      z.string().optional(),
  phone:     z.string().optional(),
  formData:  z.record(z.unknown()),
  step:      z.number().int().min(1).max(4).optional(),
});

export async function POST(req: NextRequest) {
  after(() => sweepAbandonedIfDue().catch(() => {}));
  try {
    // Written to on every keystroke of the booking form, so a malformed body
    // is a 500 in the middle of somebody booking.
    const raw = await req.json().catch(() => null);
    if (raw === null) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const body = schema.parse(raw);

    const fd = body.formData as Prisma.InputJsonValue;
    const session = await prisma.bookingSession.upsert({
      where:  { sessionId: body.sessionId },
      update: {
        email:        body.email,
        name:         body.name,
        phone:        body.phone,
        formData:     fd,
        step:         body.step,
        lastActivity: new Date(),
      },
      create: {
        sessionId: body.sessionId,
        email:     body.email,
        name:      body.name,
        phone:     body.phone,
        formData:  fd,
        step:      body.step ?? 1,
      },
    });

    // Tell the office straight away, the first time a session has a full set of
    // contact details. The daily recovery job is for the discount offer; this
    // is so somebody can ring while the customer is still on the page.
    // after(), not a bare void. This handler returns as soon as the session
    // is saved, and on serverless the instance can be frozen the moment it
    // does, taking an unawaited promise with it. The alert needs three
    // database round trips and an HTTP call to Resend before it has sent
    // anything, so it rarely survived that race — which is why leads stopped
    // arriving. after() is already used a few lines above for the sweep.
    after(() => alertOnFirstContact(body, session.converted));

    return NextResponse.json({ ok: true, id: session.id });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const session = await prisma.bookingSession.findUnique({ where: { sessionId } });
  if (!session) return NextResponse.json(null);
  return NextResponse.json(session);
}

export async function DELETE(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  await prisma.bookingSession.updateMany({
    where: { sessionId },
    data:  { converted: true },
  });
  return NextResponse.json({ ok: true });
}

/**
 * Fires once per session, and only with a complete set of contact details.
 *
 * Dedupe is against the email log rather than a new column on the session, so
 * this needed no migration. A failure here must never fail the save — the
 * customer's progress matters more than the alert.
 *
 * ── Why this is not a plain "count, then send" ──
 *
 * It used to be, and the office got two identical lead emails for one customer.
 * The booking form saves as the customer types, so two requests routinely
 * overlap: both counted zero, because neither had written its log row yet —
 * that row is only written when the send finishes, several hundred milliseconds
 * later — and both sent.
 *
 * So the row is written *first*, as a PENDING claim, and the winner is then
 * decided by reading back the earliest claim for this session. Ordering by
 * createdAt and then by id makes that choice deterministic even when two rows
 * land in the same millisecond, so concurrent requests agree on which of them
 * sends. The loser removes its own claim and says nothing.
 *
 * This needs no unique index, no advisory lock and no migration, which matters
 * because schema changes here are applied by hand against the live database.
 */
async function alertOnFirstContact(
  body: { sessionId: string; email?: string; name?: string; phone?: string; formData: Record<string, unknown> },
  converted: boolean,
) {
  try {
    if (converted) return;
    const { email, name, phone } = body;
    if (!email || !name || !phone) return;

    const subject = `LEAD ${body.sessionId}`;
    const adminEmail = process.env.ADMIN_EMAIL ?? COMPANY.email;

    // Cheap path: an earlier request already claimed or sent this one.
    // Only a SENT row means this lead has been reported. A FAILED one
    // should be tried again, and a PENDING one is either a request that is
    // still in flight or a claim whose send died — the first must block, the
    // second must not, and the only thing telling them apart is age.
    const priors = await prisma.emailLog.findMany({
      where: { type: "ADMIN_LEAD", subject },
      select: { id: true, status: true, createdAt: true },
    });
    if (priors.some((r) => r.status === "SENT")) return;

    const CLAIM_TTL_MS = 5 * 60_000;
    const live = priors.filter(
      (r) => r.status === "PENDING" && Date.now() - r.createdAt.getTime() < CLAIM_TTL_MS,
    );
    if (live.length > 0) return;

    // Anything older than that is a claim whose send never finished. Left
    // alone it blocked this session's alert permanently, and silently: the
    // count above saw a row and returned, so the lead was never reported and
    // never would be. One was still sitting there from two days earlier.
    const stale = priors.filter((r) => r.status !== "SENT");
    if (stale.length > 0) {
      await prisma.emailLog.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } }).catch(() => {});
    }

    // Stake the claim before sending, so an overlapping request can see it.
    const claim = await prisma.emailLog.create({
      data: { to: adminEmail, subject, type: "ADMIN_LEAD", status: "PENDING" },
    });

    const winner = await prisma.emailLog.findFirst({
      where:   { type: "ADMIN_LEAD", subject },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select:  { id: true },
    });

    if (winner?.id !== claim.id) {
      await prisma.emailLog.delete({ where: { id: claim.id } }).catch(() => {});
      return;
    }

    const fd = body.formData as {
      pickupAddress?: string; dropoffAddress?: string;
      date?: string; time?: string; passengers?: number;
    };

    await sendNewLeadAlert({
      name, email, phone,
      pickup:     fd.pickupAddress ?? null,
      dropoff:    fd.dropoffAddress ?? null,
      when:       fd.date ? `${fd.date}${fd.time ? ` ${fd.time}` : ""}` : null,
      passengers: fd.passengers ?? null,
      sessionId:  body.sessionId,
    });

    // sendNewLeadAlert writes its own SENT row on the way out, and that row is
    // what blocks any later request. The claim has done its job, so it goes —
    // otherwise the email log carries two entries for every lead.
    //
    // Only on success. If the send threw we never reach here and the claim
    // stays, which is deliberate: a failed alert should not be retried on the
    // customer's next keystroke and mailed out three saves later.
    await prisma.emailLog.delete({ where: { id: claim.id } }).catch(() => {});
  } catch (err) {
    console.error("[booking-session] lead alert failed", err);
  }
}
