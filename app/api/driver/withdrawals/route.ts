import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

async function getDriver(userId: string) {
  return prisma.driver.findUnique({ where: { userId } });
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;
  if (!session || user?.role !== "DRIVER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const driver = await getDriver(user.id!);
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const withdrawals = await prisma.withdrawal.findMany({
    where:   { driverId: driver.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(withdrawals);
}

const schema = z.object({
  amount:    z.number().positive(),
  method:    z.enum(["BANK", "BIZUM"]),
  bankIban:  z.string().optional(),
  bankName:  z.string().optional(),
  bizumPhone:z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string } | undefined;
  if (!session || user?.role !== "DRIVER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const driver = await getDriver(user.id!);
  if (!driver) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
  if (driver.status !== "APPROVED") return NextResponse.json({ error: "Account not yet approved" }, { status: 403 });

  try {
    const body = schema.parse(await req.json());

    const withdrawal = await prisma.withdrawal.create({
      data: {
        driverId:   driver.id,
        amount:     body.amount,
        method:     body.method,
        bankIban:   body.bankIban,
        bankName:   body.bankName,
        bizumPhone: body.bizumPhone,
        status:     "PENDING",
      },
    });

    return NextResponse.json(withdrawal, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
