import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { identifyParticipant } from "@/lib/trip-chat";

export const dynamic = "force-dynamic";

/**
 * The passenger's own position, shared with their chauffeur.
 *
 *   POST   { lat, lng, code? }   the customer's phone, every few seconds while sharing
 *   DELETE { code? }             they stopped sharing; nothing is kept
 *   GET    ?code=                the chauffeur, the company or the office reading it
 *
 * Only ever the latest fix, on the booking row: there is no trail of where a
 * customer has walked, only where they are now, and it is gone when they
 * switch it off.
 */
const schema = z.object({
  lat:  z.number().min(-90).max(90),
  lng:  z.number().min(-180).max(180),
  code: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid position" }, { status: 400 });
  const me = await identifyParticipant(id, parsed.data.code);
  if (!me || me.sender !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.booking.update({
    where: { id },
    data: { customerLat: parsed.data.lat, customerLng: parsed.data.lng, customerLocatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = req.nextUrl.searchParams.get("code");
  const me = await identifyParticipant(id, code);
  if (!me || me.sender !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.booking.update({ where: { id }, data: { customerLat: null, customerLng: null, customerLocatedAt: null } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await identifyParticipant(id, req.nextUrl.searchParams.get("code"));
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await prisma.booking.findUnique({ where: { id }, select: { customerLat: true, customerLng: true, customerLocatedAt: true } });
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const fresh = b.customerLocatedAt ? Date.now() - b.customerLocatedAt.getTime() < 3 * 60_000 : false;
  return NextResponse.json({
    sharing: fresh,
    lat: fresh ? b.customerLat : null,
    lng: fresh ? b.customerLng : null,
    at:  b.customerLocatedAt,
  });
}
