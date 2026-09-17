import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";

/** The company's own record: contact details and where to send its money. */
export async function GET() {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(p);
}

const schema = z.object({
  contactName: z.string().min(2).optional(),
  phone:       z.string().min(6).optional(),
  taxId:       z.string().nullable().optional(),
  address:     z.string().nullable().optional(),
  bankHolder:  z.string().nullable().optional(),
  bankIban:    z.string().nullable().optional(),
  bizumPhone:  z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const data = { ...parsed.data };
  if (data.bankIban) data.bankIban = data.bankIban.replace(/\s+/g, "").toUpperCase();
  const updated = await prisma.fleetPartner.update({ where: { id: p.id }, data });
  return NextResponse.json(updated);
}
