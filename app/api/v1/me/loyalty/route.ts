import { prisma } from "@/lib/prisma";
import { apiHandler } from "@/lib/api/v1/response";
import { TIER_BY_ID, nextTierFor, resolveTier } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me/loyalty
 *
 * The customer's membership: their tier, what they have spent, the next tier and how
 * far away it is, and the perks. Exactly what the website's loyalty page shows, from the
 * same tier table (lib/loyalty), so the two cannot disagree. There are no invented
 * "points": the ladder is real, and it is spend.
 */
export const GET = apiHandler(
  "me.loyalty",
  async ({ auth }) => {
    const profile = await prisma.customerProfile.findUnique({ where: { userId: auth!.userId }, select: { totalSpent: true, isVip: true } });
    const spent = Math.round((profile?.totalSpent ?? 0) * 100) / 100;
    const tier = resolveTier(spent, profile?.isVip ?? false);
    const next = nextTierFor(tier);
    const completed = await prisma.booking.count({ where: { userId: auth!.userId, status: "COMPLETED", isDeleted: false } });
    return {
      tier: tier,
      label: TIER_BY_ID[tier].label,
      perks: TIER_BY_ID[tier].perks,
      spent,
      ridesCompleted: completed,
      next: next ? { tier: next.id, label: next.label, threshold: next.threshold, remaining: Math.max(0, Math.round((next.threshold - spent) * 100) / 100), perks: next.perks } : null,
    };
  },
  { auth: { roles: ["CUSTOMER"] } },
);
