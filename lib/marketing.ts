import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = randomBytes(6);
  const suffix = Array.from(rand).map((b) => chars[b % chars.length]).join("");
  return `ELITE-${suffix}`;
}

export async function createAbandonedCoupon(email: string): Promise<string> {
  const code = generateCouponCode();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
  await prisma.coupon.create({
    data: { code, email, discountPct: 5, expiresAt },
  });
  return code;
}

export async function validateCoupon(code: string, email: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) return { valid: false, reason: "Coupon not found" };
  if (!coupon.isActive) return { valid: false, reason: "Coupon is no longer active" };
  if (coupon.usedAt) return { valid: false, reason: "Coupon already used" };
  if (coupon.expiresAt < new Date()) return { valid: false, reason: "Coupon has expired" };
  if (coupon.email && coupon.email.toLowerCase() !== email.toLowerCase())
    return { valid: false, reason: "Coupon is linked to a different email" };
  return { valid: true, coupon };
}

export async function redeemCoupon(code: string, bookingId: string) {
  await prisma.coupon.update({
    where: { code },
    data: { usedAt: new Date(), isActive: false, bookingId },
  });
}

export async function logEmail(data: {
  to: string;
  subject: string;
  type: string;
  status?: string;
  resendId?: string;
  campaignId?: string;
  bookingId?: string;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        to: data.to,
        subject: data.subject,
        type: data.type,
        status: data.status ?? "SENT",
        resendId: data.resendId,
        campaignId: data.campaignId,
        bookingId: data.bookingId,
      },
    });
  } catch { /* non-blocking */ }
}
