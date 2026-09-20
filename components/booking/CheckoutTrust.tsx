"use client";

import { Shield, Plane, UserCheck, Star, ExternalLink } from "lucide-react";
import { REVIEWS, GOOGLE_PROFILE } from "@/data/reviews";
import { PROTECTION_CUTOFF_HOURS, FREE_CANCEL_HOURS } from "@/lib/checkout-money";

/**
 * What sits under the pay button.
 *
 * Every claim here is true elsewhere on the site — the 24-hour cancellation,
 * flight tracking, the name board — but none of it was next to the button at
 * the moment a customer decides whether to type a card number. Real Google
 * reviews, with the reviewer's name as it appears on the profile, do the rest.
 */

/** Short, verified, with words: the three that read best in two lines. */
function pickReviews(n: number) {
  return REVIEWS
    .filter((r) => r.verified && r.text && r.rating === 5 && r.text.length >= 60 && r.text.length <= 220)
    .slice(0, n);
}

export default function CheckoutTrust({ protectionTaken = false }: { protectionTaken?: boolean }) {
  const reviews = pickReviews(3);
  const profileUrl = `https://www.google.com/maps?cid=${GOOGLE_PROFILE.cid}`;

  const points = [
    {
      Icon: Shield,
      t: protectionTaken ? `Cancel free up to ${PROTECTION_CUTOFF_HOURS} hours before pickup` : `Free cancellation up to ${FREE_CANCEL_HOURS} hours before pickup`,
      d: protectionTaken ? "Full refund of the fare; only the protection fee stays." : "Change of plan? Cancel from your confirmation email and the full amount comes back.",
    },
    { Icon: Plane, t: "Flight tracked — no charge for delays", d: "Your chauffeur follows the flight and adjusts; 60 minutes of waiting after landing is included." },
    { Icon: UserCheck, t: "Meet & greet with a name board included", d: "Your chauffeur waits in the arrivals hall with your name, at no extra cost." },
  ];

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-3">
        {points.map(({ Icon, t, d }) => (
          <li key={t} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
            <p className="flex items-start gap-2 text-[13px] font-medium text-white">
              <Icon size={14} className="mt-0.5 flex-shrink-0 text-gold-400" />
              {t}
            </p>
            <p className="mt-1 pl-[22px] text-[11px] leading-relaxed text-dark-400">{d}</p>
          </li>
        ))}
      </ul>

      {reviews.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] text-white">
              <span className="flex text-gold-400" aria-label={`${GOOGLE_PROFILE.rating} out of 5`}>
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
              </span>
              <span className="font-medium">{GOOGLE_PROFILE.rating.toFixed(1)}</span>
              <span className="text-dark-400">· {GOOGLE_PROFILE.count} Google reviews</span>
            </p>
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-gold-400 hover:underline">
              Read them on Google <ExternalLink size={10} />
            </a>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.author} className="text-[12px] leading-relaxed text-dark-300">
                <p className="line-clamp-4">&ldquo;{r.text}&rdquo;</p>
                <p className="mt-1.5 text-[11px] text-dark-500">— {r.author}{r.when ? `, ${r.when}` : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
