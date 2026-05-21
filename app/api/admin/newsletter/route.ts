import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNewsletterCampaign } from "@/lib/resend";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string })?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") ?? "subscribers";

  if (type === "campaigns") {
    const campaigns = await prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return NextResponse.json(campaigns);
  }

  const [subscribers, total, active] = await Promise.all([
    prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
  ]);
  return NextResponse.json({ subscribers, total, active });
}

const campaignSchema = z.object({
  subject:     z.string().min(2),
  htmlBody:    z.string().min(10),
  scheduledAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = campaignSchema.parse(await req.json());
    const subscribers = await prisma.newsletterSubscriber.findMany({ where: { isActive: true } });

    const campaign = await prisma.emailCampaign.create({
      data: {
        subject:     body.subject,
        htmlBody:    body.htmlBody,
        status:      "SENDING",
        sentAt:      new Date(),
        targetCount: subscribers.length,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });

    // Send in batches of 10 (Resend rate limit)
    let sentCount = 0;
    for (let i = 0; i < subscribers.length; i += 10) {
      const batch = subscribers.slice(i, i + 10);
      await Promise.allSettled(
        batch.map((sub) =>
          sendNewsletterCampaign({
            to:          sub.email,
            subject:     body.subject,
            htmlBody:    body.htmlBody,
            campaignId:  campaign.id,
            unsubToken:  encodeURIComponent(sub.email),
          })
        )
      );
      sentCount += batch.length;
    }

    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data:  { status: "SENT", targetCount: sentCount },
    });

    return NextResponse.json({ ok: true, sent: sentCount, campaignId: campaign.id });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.errors[0].message }, { status: 422 });
    return NextResponse.json({ error: "Campaign failed" }, { status: 500 });
  }
}
