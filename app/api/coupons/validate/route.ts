import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/marketing";
import { z } from "zod";

const schema = z.object({
  code:  z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const { code, email } = schema.parse(await req.json());
    const result = await validateCoupon(code.toUpperCase().trim(), email);
    if (!result.valid) return NextResponse.json({ valid: false, reason: result.reason }, { status: 400 });
    return NextResponse.json({
      valid:       true,
      discountPct: result.coupon!.discountPct,
      expiresAt:   result.coupon!.expiresAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ valid: false, reason: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ valid: false, reason: "Validation error" }, { status: 500 });
  }
}
