import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/partner";
import { EARNINGS_VIEWS, partnerEarnings, type EarningsView } from "@/lib/partner-earnings";

export const dynamic = "force-dynamic";

/**
 * What the company earned, by day, week or month.
 *
 * These are the company's own figures: its payout from Elite BCN and what it
 * promised its drivers. The customer's fare is not here and is not in the
 * data this reads from.
 */
export async function GET(req: NextRequest) {
  const p = await requirePartner({ allowInactive: true });
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asked = req.nextUrl.searchParams.get("view") ?? "day";
  if (!(EARNINGS_VIEWS as string[]).includes(asked)) return NextResponse.json({ error: "view must be day, week or month" }, { status: 422 });

  return NextResponse.json(await partnerEarnings(p.id, asked as EarningsView));
}
