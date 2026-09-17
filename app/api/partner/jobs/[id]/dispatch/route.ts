import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePartner, dispatchPartnerJob } from "@/lib/partner";

/**
 * The company putting one of its drivers on a job.
 *
 * driverAmount is what that driver is shown as their earnings for it — the
 * company decides this, and it need not equal the payout the office set.
 */
const schema = z.object({
  driverId:     z.string().min(1),
  driverAmount: z.number().min(0).nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  try {
    const b = await dispatchPartnerJob(p.id, id, parsed.data.driverId, parsed.data.driverAmount ?? null);
    return NextResponse.json({ id: b.id, status: b.status, driverId: b.driverId, driverAmount: b.driverAmount, partnerDispatchedAt: b.partnerDispatchedAt });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
