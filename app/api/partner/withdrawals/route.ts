import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePartner, partnerBalance, requestPartnerWithdrawal } from "@/lib/partner";

export async function GET() {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [withdrawals, balance, ledger] = await Promise.all([
    prisma.partnerWithdrawal.findMany({ where: { partnerId: p.id }, orderBy: { createdAt: "desc" } }),
    partnerBalance(p.id),
    prisma.booking.findMany({
      where: { partnerId: p.id, isDeleted: false, status: "COMPLETED" },
      orderBy: { rideEndedAt: "desc" },
      take: 200,
      select: {
        id: true, confirmationCode: true, pickupAddress: true, dropoffAddress: true,
        pickupDatetime: true, rideEndedAt: true, partnerPayout: true, driverAmount: true,
        driver: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);
  return NextResponse.json({ withdrawals, balance, ledger });
}

const schema = z.object({
  amount:     z.number().positive(),
  method:     z.enum(["BANK", "BIZUM"]),
  bankIban:   z.string().optional(),
  bankHolder: z.string().optional(),
  bizumPhone: z.string().optional(),
  notes:      z.string().optional(),
});

export async function POST(req: NextRequest) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  try {
    // Fall back to the bank details on the account so the form need not
    // repeat them every time.
    const w = await requestPartnerWithdrawal(p.id, {
      ...parsed.data,
      bankIban:   parsed.data.bankIban   || p.bankIban   || undefined,
      bankHolder: parsed.data.bankHolder || p.bankHolder || undefined,
      bizumPhone: parsed.data.bizumPhone || p.bizumPhone || undefined,
    });
    return NextResponse.json(w, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
