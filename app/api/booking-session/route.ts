import { NextRequest, NextResponse } from "next/server";
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
  try {
    const body = schema.parse(await req.json());

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
    void alertOnFirstContact(body, session.converted);

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
    const already = await prisma.emailLog.count({ where: { type: "ADMIN_LEAD", subject } });
    if (already > 0) return;

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
