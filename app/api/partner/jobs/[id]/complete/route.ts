import { NextRequest, NextResponse } from "next/server";
import { requirePartner, completePartnerJob } from "@/lib/partner";

/** The company marking a dispatched job done; its payout becomes available. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const b = await completePartnerJob(p.id, id);
    return NextResponse.json({ id: b.id, status: b.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
