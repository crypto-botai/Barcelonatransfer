import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logEmail } from "@/lib/marketing";
import { resend } from "@/lib/resend";
import { z } from "zod";

const schema = z.object({
  email:  z.string().email(),
  name:   z.string().optional(),
  source: z.string().optional(),
});

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
const FROM     = "Élite BCN Transfers <noreply@elitebcntransfers.com>";

const rateMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const times = (rateMap.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= 3) return true;
  rateMap.set(ip, [...times, now]);
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (isRateLimited(ip))
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  try {
    const { email, name, source } = schema.parse(await req.json());

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      if (!existing.isActive) {
        await prisma.newsletterSubscriber.update({
          where: { email },
          data:  { isActive: true, unsubscribedAt: null, confirmedAt: new Date() },
        });
        return NextResponse.json({ ok: true, resubscribed: true });
      }
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }

    await prisma.newsletterSubscriber.create({
      data: { email, name, source, confirmedAt: new Date() },
    });

    // Send confirmation email (fire-and-forget)
    resend.emails.send({
      from: FROM, to: email,
      subject: "Welcome to Élite BCN — You're on the list 🎉",
      html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#d0d0d0;padding:36px;">
        <h2 style="color:#c9a84c;">Welcome to Élite BCN!</h2>
        <p>Hi ${name ?? "there"},</p>
        <p>You're now subscribed to our newsletter. You'll receive exclusive deals, travel tips, and Barcelona insider guides.</p>
        <p style="margin-top:16px;"><a href="${SITE_URL}/book" style="background:#c9a84c;color:#000;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Book a Transfer</a></p>
        <p style="margin-top:24px;font-size:12px;color:#555;"><a href="${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}" style="color:#777;">Unsubscribe</a></p>
      </div>`,
    }).catch(() => {});

    await logEmail({ to: email, subject: "Newsletter welcome", type: "NEWSLETTER_WELCOME" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Subscription failed" }, { status: 500 });
  }
}
