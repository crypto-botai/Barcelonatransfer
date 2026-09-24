import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailDocument, passwordResetCard } from "@/lib/email/premium";
import { resend } from "@/lib/resend";
import crypto from "crypto";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
const FROM = process.env.RESEND_FROM ?? "Elite BCN Transfers <noreply@elitebcn.info>";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const normalised = email.toLowerCase().trim();

    // Always return 200 — never reveal whether the email exists
    const user = await prisma.user.findUnique({ where: { email: normalised } });
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    // Delete any existing reset token for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `pwd-reset:${normalised}` },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: `pwd-reset:${normalised}`,
        token,
        expires,
      },
    });

    const resetUrl = `${SITE_URL}/auth/reset-password?token=${token}`;

    const emailResult = await resend.emails.send({
      from: FROM,
      to: normalised,
      subject: "Reset your Elite BCN password",
      html: emailDocument(
        passwordResetCard({
          name: user.name,
          email: normalised,
          resetUrl,
          expiresIn: "one hour",
        }),
        "Choose a new password for your Elite BCN account. The link expires in one hour.",
      ),
    });

    if (emailResult?.error) {
      const msg = (emailResult.error as { message?: string }).message ?? JSON.stringify(emailResult.error);
      console.error("[forgot-password] Resend error:", msg);
      return NextResponse.json({ error: "Failed to send email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
