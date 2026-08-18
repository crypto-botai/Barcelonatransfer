import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sendNewLeadAlert } from "@/lib/resend";

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
 */
async function alertOnFirstContact(
  body: { sessionId: string; email?: string; name?: string; phone?: string; formData: Record<string, unknown> },
  converted: boolean,
) {
  try {
    if (converted) return;
    const { email, name, phone } = body;
    if (!email || !name || !phone) return;

    const already = await prisma.emailLog.count({
      where: { type: "ADMIN_LEAD", subject: `LEAD ${body.sessionId}` },
    });
    if (already > 0) return;

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
  } catch (err) {
    console.error("[booking-session] lead alert failed", err);
  }
}
