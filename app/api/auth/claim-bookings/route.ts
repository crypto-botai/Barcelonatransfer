import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { linkGuestBookings, verifyClaimToken } from "@/lib/claim-bookings";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/claim-bookings?token=...
 *
 * The link in the "add your bookings to your account" email. The token is signed by the server for one account and one email;
 * opening it proves the person can read that mailbox, so the bookings made as a guest with that email are given to the account.
 * It then goes to the dashboard. A bad or expired link goes to the same place without changing anything.
 */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const claim = token ? verifyClaimToken(token) : null;
  if (!claim) return NextResponse.redirect(`${base}/dashboard?claimed=expired`);

  const user = await prisma.user.findUnique({ where: { id: claim.userId }, select: { id: true, email: true, role: true } });
  // The token is for the email the account had when it was sent: if the address has changed since, it no longer proves anything.
  if (!user || user.role !== "CUSTOMER" || user.email.trim().toLowerCase() !== claim.email) return NextResponse.redirect(`${base}/dashboard?claimed=expired`);

  const count = await linkGuestBookings(user.id, user.email);
  return NextResponse.redirect(`${base}/dashboard?claimed=${count}`);
}
