import { EXTRAS_CATALOG } from "@/types";

/**
 * Membership tiers — one definition, read by everything.
 *
 * There were three copies before this file, and they disagreed. The loyalty
 * page told customers Gold began at €500; the stats API granted it at €1,000.
 * Someone who had spent €600 saw a progress bar reading "you are Gold" while
 * every other part of the site still treated them as Silver.
 *
 * The advertised figure wins. A threshold shown to a customer is a promise, and
 * the cheaper of two contradictory promises is not the one to keep.
 */
export type MemberTier = "Silver" | "Gold" | "VIP";

export interface Tier {
  id:        MemberTier;
  label:     string;
  /** Total amount paid, in euros, at which the tier is reached. */
  threshold: number;
  /** VIP is granted by hand in Admin → Customers, never by spend. */
  earnedBySpend: boolean;
  icon:      string;
  color:     string;
  border:    string;
  textColor: string;
  perks:     string[];
}

/**
 * Extras waived for a tier, by catalogue id.
 *
 * Gold's "free meet & greet" was decoration until now: nothing in the booking
 * path had ever heard of a tier, so the €5 was charged to Gold members exactly
 * as it was to everyone else.
 */
const WAIVED_EXTRAS: Record<MemberTier, readonly string[]> = {
  Silver: [],
  Gold:   ["meet_greet"],
  VIP:    ["meet_greet", "name_board"],
};

export const TIERS: Tier[] = [
  {
    id: "Silver",
    label: "Silver",
    threshold: 0,
    earnedBySpend: true,
    icon: "⚡",
    color: "from-slate-400/10 to-transparent",
    border: "border-slate-400/20",
    textColor: "text-slate-300",
    perks: ["Priority support", "1% cashback points", "Birthday discount"],
  },
  {
    id: "Gold",
    label: "Gold",
    threshold: 500,
    earnedBySpend: true,
    icon: "⭐",
    color: "from-gold-500/15 to-transparent",
    border: "border-gold-500/30",
    textColor: "text-gold-400",
    perks: [
      "Priority booking",
      "2% cashback points",
      "Meet & greet included (normally €5)",
      "Dedicated phone line",
      "Birthday discount 10%",
    ],
  },
  {
    id: "VIP",
    label: "VIP Elite",
    // Invitation only. The page used to show €2,000 as though spending it were
    // enough, which nothing in the code has ever honoured — VIP is the isVip
    // flag an admin sets. Advertising an automatic upgrade that never arrives
    // is worse than not advertising one, so the threshold is not a spend gate.
    threshold: 2000,
    earnedBySpend: false,
    icon: "👑",
    color: "from-purple-500/15 to-transparent",
    border: "border-purple-500/30",
    textColor: "text-purple-300",
    perks: [
      "Dedicated concierge 24/7",
      "5% cashback points",
      "Meet & greet and name board included",
      "Priority dispatch",
      "By invitation",
    ],
  },
];

export const TIER_BY_ID: Record<MemberTier, Tier> = Object.fromEntries(
  TIERS.map((t) => [t.id, t]),
) as Record<MemberTier, Tier>;

/**
 * The tier a customer is actually in.
 *
 * @param totalSpent total of their PAID bookings, in euros
 * @param isVip the admin-set flag; the only route to VIP
 */
export function resolveTier(totalSpent: number, isVip = false): MemberTier {
  if (isVip) return "VIP";
  const spend = Number.isFinite(totalSpent) ? totalSpent : 0;
  // Highest earned tier wins, so adding a tier between two others needs no
  // change here.
  const earned = TIERS.filter((t) => t.earnedBySpend && spend >= t.threshold);
  return earned.length ? earned[earned.length - 1].id : "Silver";
}

/** Next tier up, or null at the top of the ladder a customer can earn. */
export function nextTierFor(tier: MemberTier): Tier | null {
  const i = TIERS.findIndex((t) => t.id === tier);
  return TIERS.slice(i + 1).find((t) => t.earnedBySpend) ?? null;
}

/** True when this tier gets the named extra at no charge. */
export function isExtraWaived(tier: MemberTier, extraId: string): boolean {
  return WAIVED_EXTRAS[tier]?.includes(extraId) ?? false;
}

/**
 * Server-side cost of the chosen extras.
 *
 * Prices come from EXTRAS_CATALOG by id, never from the request. The client
 * used to send its own `price` for each extra and the total was computed from
 * it, so a crafted request could book a Sprinter to Andorra with an extra
 * priced at minus five hundred euros. An unknown id contributes nothing rather
 * than trusting whatever label came with it.
 */
export function extrasCostFor(
  extras: readonly { id: string; price?: number; quantity: number }[] | undefined,
  tier: MemberTier = "Silver",
): number {
  return (extras ?? []).reduce((sum, e) => {
    if (isExtraWaived(tier, e.id)) return sum;
    const known = EXTRAS_CATALOG.find((c) => c.id === e.id);
    if (!known) return sum;
    const qty = Math.max(0, Math.min(e.quantity, known.maxQty));
    return sum + known.price * qty;
  }, 0);
}
