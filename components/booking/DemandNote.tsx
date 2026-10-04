import type { QuoteResponse } from "@/types";

/**
 * How busy the pick-up and the drop-off are, beside the price.
 *
 * Only two things are ever said: this is a high demand area, or a low demand
 * one. An ordinary area is left unlabelled, because a label on everything says
 * nothing. It carries no percentage and no price: it says how busy, and the
 * price above it is the price.
 *
 * The words come from the caller, in the customer's language.
 */
export default function DemandNote({
  demand, high, low, className = "",
}: {
  demand: QuoteResponse["demand"];
  high: string;
  low: string;
  className?: string;
}) {
  const items = [demand?.pickup, demand?.dropoff].filter((d): d is NonNullable<typeof d> => Boolean(d));
  if (items.length === 0) return null;

  // The same area at both ends is said once.
  const seen = new Set<string>();
  const unique = items.filter((d) => (seen.has(`${d.label}:${d.level}`) ? false : (seen.add(`${d.label}:${d.level}`), true)));

  return (
    <ul className={`flex flex-wrap items-center justify-center gap-2 ${className}`} aria-label={`${high} / ${low}`}>
      {unique.map((d) => (
        <li
          key={`${d.label}:${d.level}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            d.level === "high"
              ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {d.label}
          <span aria-hidden className="opacity-50">·</span>
          {d.level === "high" ? high : low}
        </li>
      ))}
    </ul>
  );
}
