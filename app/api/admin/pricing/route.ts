import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type VehicleClass } from "@/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await req.json() as {
    vehicleClass: VehicleClass;
    baseFare: number;
    pricePerKm: number;
    pricePerMinute: number;
    minimumFare: number;
    airportSurcharge: number;
    nightSurcharge: number;
  }[];

  await Promise.all(
    rules.map((r) =>
      prisma.pricingRule.upsert({
        where:  { vehicleClass: r.vehicleClass },
        update: { ...r },
        create: { ...r },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
