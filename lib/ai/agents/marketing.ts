/**
 * Marketing Agent — drafts campaigns, social posts, and newsletters.
 *
 * Work output goes to the ApprovalItem queue (type: "MARKETING_DRAFT").
 * Nothing is auto-published. Admin reviews at /admin/hq/learning.
 *
 * Each run:
 *  1. Reads DB context: recent bookings, top vehicle class, revenue trend, KB count
 *  2. Checks what was already proposed this week (avoids duplicate drafts)
 *  3. Asks AI to produce:
 *       • 3 social media posts (IG/FB/X) — one highlight, one testimonial angle, one seasonal
 *       • 1 short email newsletter (subject + body)
 *       • 1 promotional campaign idea
 *  4. Saves each as a separate ApprovalItem for admin review
 *  5. Writes a REPORT memory summarising this run
 */

import { prisma } from "@/lib/prisma";
import { BaseAgent } from "@/lib/ai/agents/base";
import { callProvider } from "@/lib/ai/providers";
import { saveMemory } from "@/lib/ai/memory";
import { log } from "@/lib/ai/logger";

const BRAND_VOICE = `
Brand: Élite BCN Transfers — luxury VTC chauffeur service in Barcelona, Spain.
Tone: premium, confident, effortless elegance. Never salesy. Short & punchy.
Fleet: Mercedes V-Class (7 pax), Mercedes EQE 300 Electric (4 pax), Mercedes Vito (8 pax), Mercedes Sprinter (minibus).
Services: airport transfers, cruise port, hourly hire, corporate, day tours.
Key differentiators: fixed prices, no surge, <3 year vehicles, bilingual drivers, 24/7.
Website: https://www.elitebcn.info | WhatsApp: +34 635 383 712
`.trim();

export class MarketingAgent extends BaseAgent {
  readonly name        = "marketing";
  readonly description = "Marketing & Growth — drafts social posts, newsletters, and campaigns for admin approval.";

  async execute(): Promise<void> {
    await log({ agentId: this.agentId, taskId: this.taskId, action: "marketing_start", message: "Gathering business context" });

    // ── 1. Business context ─────────────────────────────────────────────────
    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [revenue7d, topVehicle, recentReviews, existingDraftsThisWeek] = await Promise.all([
      prisma.booking.aggregate({
        where: { paymentStatus: "PAID", createdAt: { gte: since7d } },
        _sum:  { totalAmount: true },
        _count: true,
      }),
      prisma.booking.groupBy({
        by:      ["vehicleClass"],
        where:   { createdAt: { gte: since30d } },
        _count:  true,
        orderBy: { _count: { vehicleClass: "desc" } },
        take:    1,
      }),
      // Use existing knowledge base as proxy for testimonial material
      prisma.knowledgeBase.findMany({
        where:   { isActive: true, category: { contains: "testimonial", mode: "insensitive" } },
        take:    3,
        orderBy: { usageCount: "desc" },
        select:  { question: true, answer: true },
      }),
      // Don't re-propose marketing drafts from this week
      prisma.approvalItem.count({
        where: {
          type:      "MARKETING_DRAFT",
          createdAt: { gte: since7d },
        },
      }),
    ]);

    const rev7d      = revenue7d._sum.totalAmount ?? 0;
    const bookings7d = revenue7d._count;
    const topClass   = topVehicle[0]?.vehicleClass ?? "BUSINESS";
    const weekDay    = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    // Skip if we already produced drafts this week (avoid spamming the queue)
    if (existingDraftsThisWeek >= 3) {
      this.taskOutput = { skipped: true, reason: "Drafts already produced this week", existingDraftsThisWeek };
      await log({
        agentId: this.agentId, taskId: this.taskId,
        action:  "marketing_skip",
        message: `Already produced ${existingDraftsThisWeek} drafts this week — skipping`,
      });
      return;
    }

    await log({ agentId: this.agentId, taskId: this.taskId, action: "marketing_generate", message: "Calling AI for drafts" });

    // ── 2. AI generates the content pack ────────────────────────────────────
    const contextBlock = [
      `Today: ${weekDay}`,
      `7-day bookings: ${bookings7d} | 7-day revenue: €${rev7d.toFixed(0)}`,
      `Most booked vehicle: ${topClass}`,
      recentReviews.length
        ? `Customer testimonial material: "${recentReviews[0]?.answer?.slice(0, 200)}"`
        : "No testimonials available — focus on service features",
    ].join("\n");

    const systemPrompt = `${BRAND_VOICE}\n\nYou are the marketing copywriter for Élite BCN Transfers. Write compelling, brand-aligned content. Do NOT invent prices — say "competitive fixed rates" or "from €X" only if X is below €45. Output ONLY the JSON object requested.`;

    const userPrompt = `Business context:
${contextBlock}

Generate a marketing content pack. Respond with a single JSON object:
{
  "socialPosts": [
    { "platform": "Instagram", "caption": "...", "hashtags": "#BarcelonaChauffeur #EliteBCN" },
    { "platform": "Facebook",  "caption": "...", "hashtags": "..." },
    { "platform": "X/Twitter", "caption": "..." }
  ],
  "newsletter": {
    "subject": "...",
    "preview": "...",
    "body": "2–3 short paragraphs of email body copy"
  },
  "campaign": {
    "title": "...",
    "concept": "Brief campaign description (1–2 sentences)",
    "cta": "Call-to-action text",
    "suggestedChannels": ["Instagram","Google Ads"]
  }
}`;

    const { text, inputTokens, outputTokens, costCents } = await callProvider(
      "marketing",
      [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      { maxTokens: 1024, temperature: 0.6 },
    );
    await this.trackSpend(costCents, inputTokens, outputTokens);

    // ── 3. Parse and save drafts to approval queue ───────────────────────────
    let pack: {
      socialPosts?: Array<{ platform: string; caption: string; hashtags?: string }>;
      newsletter?:  { subject: string; preview: string; body: string };
      campaign?:    { title: string; concept: string; cta: string; suggestedChannels?: string[] };
    } = {};

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) pack = JSON.parse(jsonMatch[0]);
    } catch {
      await log({ agentId: this.agentId, taskId: this.taskId, action: "marketing_parse_error", level: "warn", message: "Could not parse AI JSON — saving raw text" });
      // Save raw as a single draft
      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "MARKETING_DRAFT",
          title:     `Marketing Content Pack — ${weekDay}`,
          preview:   text.slice(0, 2000),
          diffBefore: "No existing content",
          diffAfter:  text.slice(0, 2000),
          metadata:  { raw: true, weekDay },
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      this.taskOutput = { draftsCreated: 1, parseError: true };
      return;
    }

    const draftsCreated: string[] = [];
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Social posts
    if (pack.socialPosts?.length) {
      const preview = pack.socialPosts
        .map((p) => `[${p.platform}]\n${p.caption}${p.hashtags ? `\n${p.hashtags}` : ""}`)
        .join("\n\n---\n\n");

      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "MARKETING_DRAFT",
          title:     `Social Media Posts — ${weekDay}`,
          preview,
          diffBefore: "No posts scheduled",
          diffAfter:  preview,
          metadata:  { contentType: "social", posts: pack.socialPosts, weekDay },
          expiresAt: expires,
        },
      });
      draftsCreated.push("social");
    }

    // Newsletter
    if (pack.newsletter?.subject) {
      const nl = pack.newsletter;
      const preview = `Subject: ${nl.subject}\nPreview: ${nl.preview}\n\n${nl.body}`;
      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "MARKETING_DRAFT",
          title:     `Newsletter Draft — ${nl.subject}`,
          preview,
          diffBefore: "No newsletter scheduled",
          diffAfter:  preview,
          metadata:  { contentType: "newsletter", newsletter: nl, weekDay },
          expiresAt: expires,
        },
      });
      draftsCreated.push("newsletter");
    }

    // Campaign idea
    if (pack.campaign?.title) {
      const c = pack.campaign;
      const preview = `Campaign: ${c.title}\n\nConcept: ${c.concept}\n\nCTA: "${c.cta}"\n\nChannels: ${(c.suggestedChannels ?? []).join(", ")}`;
      await prisma.approvalItem.create({
        data: {
          agentId:   this.agentId!,
          type:      "MARKETING_DRAFT",
          title:     `Campaign Idea — ${c.title}`,
          preview,
          diffBefore: "No active campaign",
          diffAfter:  preview,
          metadata:  { contentType: "campaign", campaign: c, weekDay },
          expiresAt: expires,
        },
      });
      draftsCreated.push("campaign");
    }

    // ── 4. Memory & task output ──────────────────────────────────────────────
    this.taskOutput = { draftsCreated: draftsCreated.length, types: draftsCreated, weekDay };

    await saveMemory({
      agentId:    this.agentId,
      type:       "REPORT",
      title:      `Marketing Drafts — ${weekDay}`,
      content:    `Created ${draftsCreated.length} draft(s): ${draftsCreated.join(", ")}.\nContext: ${bookings7d} bookings this week, €${rev7d.toFixed(0)} revenue, top vehicle: ${topClass}.`,
      tags:       ["marketing", "drafts", ...draftsCreated],
      importance: 3,
      ttlDays:    14,
    });

    await log({
      agentId: this.agentId,
      taskId:  this.taskId,
      action:  "marketing_complete",
      message: `Created ${draftsCreated.length} draft(s) pending admin approval: ${draftsCreated.join(", ")}`,
    });
  }
}
