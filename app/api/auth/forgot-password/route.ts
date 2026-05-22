import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import crypto from "crypto";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
const FROM = process.env.RESEND_FROM ?? "Élite BCN Transfers <noreply@elitebcntransfers.com>";

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

    await resend.emails.send({
      from: FROM,
      to: normalised,
      subject: "Reset your Élite BCN password",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #f0ebe0; }
  .wrapper { max-width: 560px; margin: 0 auto; background: #0a0a0a; }
  .header { background: linear-gradient(135deg,#0a0a0a 0%,#1a1600 100%); padding: 36px 40px 28px; text-align: center; border-bottom: 1px solid #c9a84c; }
  .logo-text { font-size: 22px; letter-spacing: 6px; font-weight: 300; color: #fff; }
  .logo-text span { color: #c9a84c; }
  .tagline { color: #888; font-size: 11px; letter-spacing: 3px; margin-top: 8px; text-transform: uppercase; }
  .body { padding: 36px 40px; color: #d0d0d0; font-size: 15px; line-height: 1.7; }
  h2 { color: #c9a84c; font-size: 22px; margin-bottom: 16px; font-weight: 400; }
  .btn { display: inline-block; background: #c9a84c; color: #000 !important; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: bold; letter-spacing: 1px; margin: 24px 0; }
  .url-box { background: #111; border: 1px solid #333; border-radius: 6px; padding: 12px 16px; font-family: 'Courier New', monospace; font-size: 12px; color: #aaa; word-break: break-all; margin-top: 16px; }
  .footer { background: #050505; padding: 20px 40px; text-align: center; color: #555; font-size: 12px; border-top: 1px solid #1a1a1a; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo-text">ÉLITE<span>BCN</span></div>
    <p class="tagline">Luxury Transfers · Barcelona</p>
  </div>
  <div class="body">
    <h2>Reset Your Password</h2>
    <p>Hi${user.name ? ` ${user.name}` : ""},</p>
    <p style="margin-top:12px;">We received a request to reset the password for your Élite BCN account (<strong style="color:#c9a84c;">${normalised}</strong>).</p>
    <p style="margin-top:12px;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <div style="text-align:center;">
      <a href="${resetUrl}" class="btn">Reset My Password →</a>
    </div>
    <p style="color:#888;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <div class="url-box">${resetUrl}</div>
    <p style="color:#666;font-size:13px;margin-top:20px;">If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Élite BCN Transfers · <a href="tel:+34635383712" style="color:#888;">+34 635 383 712</a></p>
  </div>
</div>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
