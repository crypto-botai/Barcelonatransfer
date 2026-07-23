import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const VEHICLE_CODES = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"] as const;

const updateSchema = z.array(
  z.object({
    routeId:     z.string().cuid(),
    vehicleCode: z.enum(VEHICLE_CODES),
    price:       z.number().int().min(0).max(9999),
  })
);

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const routes = await prisma.route.findMany({
    include: { prices: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(routes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  }

  const updates = parsed.data;
  const updatedBy = user?.email ?? "admin";
  const now = new Date();

  await Promise.all(
    updates.map(({ routeId, vehicleCode, price }) =>
      prisma.routePrice.upsert({
        where:  { routeId_vehicleCode: { routeId, vehicleCode } },
        update: { price, updatedBy, updatedAt: now },
        create: { routeId, vehicleCode, price, updatedBy },
      })
    )
  );

  // Audit trail — RoutePrice.updatedBy / updatedAt records who changed what and when
  console.info(
    `[pricing-audit] ${updatedBy} updated ${updates.length} price(s) at ${now.toISOString()}:`,
    updates.map(({ routeId, vehicleCode, price }) => `${routeId}/${vehicleCode}=${price}`)
  );

  revalidateTag("pricing", {});

  return NextResponse.json({ ok: true, count: updates.length });
}
