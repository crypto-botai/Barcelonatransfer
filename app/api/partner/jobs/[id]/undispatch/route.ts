import { NextRequest, NextResponse } from "next/server";
import { requirePartner, undispatchPartnerJob } from "@/lib/partner";

/**
 * The company taking its driver back off a job.
 *
 * The counterpart to dispatch. Dispatching over the top of an existing driver
 * also worked, but it decided for the company that the job was going straight
 * to somebody else; often what has actually happened is that the flight moved
 * and nobody knows yet who will take it.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await undispatchPartnerJob(p.id, id);
    return NextResponse.json({ id: b.id, status: b.status, driverId: b.driverId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not take the job back" },
      { status: 400 },
    );
  }
}
