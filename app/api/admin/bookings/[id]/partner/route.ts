import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assignBookingToPartner, unassignBookingFromPartner } from "@/lib/partner";

/** Sending a booking to a fleet partner company, or taking it back. */
async function admin() {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string; name?: string } | undefined;
  return s && u?.role === "ADMIN" ? u : null;
}

const schema = z.object({ partnerId: z.string().min(1), payout: z.number().min(0) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await admin();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  try {
    const b = await assignBookingToPartner(id, parsed.data.partnerId, parsed.data.payout, a.name ?? "Admin");
    return NextResponse.json({ id: b.id, partnerId: b.partnerId, partnerPayout: b.partnerPayout, status: b.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await admin();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await unassignBookingFromPartner(id, a.name ?? "Admin");
    return NextResponse.json({ id: b.id, partnerId: null, status: b.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
