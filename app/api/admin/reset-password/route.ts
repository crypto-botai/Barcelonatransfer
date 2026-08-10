import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTemporaryPassword } from "@/lib/resend";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** Either a user id or an email — the admin UI has whichever is to hand. */
  userId: z.string().min(1).optional(),
  email:  z.string().email().optional(),
}).refine((v) => v.userId || v.email, { message: "userId or email required" });

/**
 * Unambiguous alphabet — no I, O, 0 or 1.
 *
 * These passwords get read off a phone screen and typed on another device, and
 * frequently dictated over the phone to a driver. Characters that look alike
 * turn into failed sign-ins and a call to the operator.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

function temporaryPassword(length = 10): string {
  let out = "";
  // randomInt is cryptographically secure; Math.random is not, and this value
  // is the only thing standing between a stranger and someone's account.
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/**
 * Issues a fresh temporary password and emails it.
 *
 * The account is flagged mustChangePassword, so middleware.ts diverts the user
 * to /auth/change-password at their next sign-in and this password stops
 * working the moment they pick their own.
 *
 * Admin only: this hands over access to someone else's account, and the new
 * password is never returned in the response — it goes to the account's own
 * email address and nowhere else, so issuing one cannot be used to read it.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const where = parsed.data.userId ? { id: parsed.data.userId } : { email: parsed.data.email! };
  const user = await prisma.user.findUnique({
    where,
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 });

  const password = temporaryPassword();
  const hash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash: hash, mustChangePassword: true },
  });

  try {
    await sendTemporaryPassword({
      to: user.email,
      name: user.name ?? "there",
      password,
      portal: user.role === "DRIVER" ? "driver" : "customer",
    });
  } catch (e) {
    // The password has already been changed on the account. Say so plainly
    // rather than implying nothing happened — the old one no longer works.
    console.error("[reset-password] email failed:", e);
    return NextResponse.json(
      { error: "Password was reset but the email could not be sent. Reset again once email is working." },
      { status: 502 },
    );
  }

  await prisma.activityLog.create({
    data: {
      action:   "RESET_PASSWORD",
      entity:   "User",
      entityId: user.id,
      details:  { email: user.email, role: user.role },
      adminId:  (session?.user as { id?: string } | undefined)?.id ?? null,
    },
  }).catch(() => {});

  // The password itself is deliberately absent from this response.
  return NextResponse.json({ ok: true, sentTo: user.email });
}
