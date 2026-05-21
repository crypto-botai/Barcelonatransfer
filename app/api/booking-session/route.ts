import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

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
