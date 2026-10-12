import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Bookings made without an account, and the account that later appears with the same email.
 *
 * A booking taken as a guest has no owner (userId empty) and carries only the email it was made with. When that email later gets an
 * account, the bookings should show up in it. But a password sign-up never proves it owns the email, so linking at sign-up would let
 * anyone who types someone else's address into the sign-up form read that person's journeys. So there are two routes:
 *   - Google sign-in: Google has verified the email, so the bookings are linked at once.
 *   - Password sign-up: an email goes to that address with a one-time link; opening it proves the address is theirs and links the
 *     bookings.
 */

const DAY_MS = 24 * 3600_000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** A link token for this account and this email, good for seven days. */
export function signClaimToken(userId: string, email: string, nowMs = Date.now()): string {
  const payload = b64(JSON.stringify({ u: userId, e: email.trim().toLowerCase(), x: nowMs + 7 * DAY_MS }));
  const mac = crypto.createHmac("sha256", secret()).update(`claim.${payload}`).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyClaimToken(token: string, nowMs = Date.now()): { userId: string; email: string } | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(`claim.${payload}`).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; e?: string; x?: number };
    if (!data.u || !data.e || typeof data.x !== "number" || data.x < nowMs) return null;
    return { userId: data.u, email: data.e };
  } catch {
    return null;
  }
}

/** Guest bookings (no owner) made with this email. */
export function guestBookingsOf(email: string) {
  return { userId: null, guestEmail: { equals: email.trim(), mode: "insensitive" as const } };
}

export async function countGuestBookings(email: string): Promise<number> {
  return prisma.booking.count({ where: guestBookingsOf(email) });
}

/** Gives the account every guest booking made with its email. Only call this once the email is known to be the person's own. Returns how many. */
export async function linkGuestBookings(userId: string, email: string): Promise<number> {
  const result = await prisma.booking.updateMany({ where: guestBookingsOf(email), data: { userId } });
  if (result.count > 0) await prisma.user.updateMany({ where: { id: userId, emailVerified: null }, data: { emailVerified: new Date() } });
  return result.count;
}

export const CLAIM_EMAIL_ACTION = "CLAIM_BOOKINGS_EMAIL";
const RESEND_AFTER_MS = 12 * 3600_000;

/**
 * If this customer account has bookings made without one, emails the address a link to add them (at most once every twelve hours).
 * Never throws: it runs beside a sign-up or a sign-in and must not get in their way.
 */
export async function offerToClaimBookings(user: { id: string; email: string; name?: string | null; role?: string | null }, send: (o: { to: string; name: string | null; count: number; claimUrl: string }) => Promise<unknown>): Promise<"sent" | "none" | "recent"> {
  try {
    if (user.role && user.role !== "CUSTOMER") return "none";
    const count = await countGuestBookings(user.email);
    if (count === 0) return "none";
    const recent = await prisma.activityLog.findFirst({ where: { action: CLAIM_EMAIL_ACTION, entity: "user", entityId: user.id, createdAt: { gte: new Date(Date.now() - RESEND_AFTER_MS) } }, select: { id: true } });
    if (recent) return "recent";
    const base = (process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info").replace(/\/$/, "");
    await send({ to: user.email, name: user.name ?? null, count, claimUrl: `${base}/api/auth/claim-bookings?token=${encodeURIComponent(signClaimToken(user.id, user.email))}` });
    await prisma.activityLog.create({ data: { action: CLAIM_EMAIL_ACTION, entity: "user", entityId: user.id, details: { count } } });
    return "sent";
  } catch (e) {
    console.error("[claim-bookings] could not offer", e instanceof Error ? e.message : e);
    return "none";
  }
}
