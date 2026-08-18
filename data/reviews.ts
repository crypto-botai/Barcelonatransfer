/**
 * Real Google reviews, transcribed from the Elite Barcelona Transfer profile.
 *
 * This file replaced six invented testimonials — names and cities that were
 * never customers. Nothing may be added here that is not on the live Google
 * profile, and the wording is the reviewer's own, not tidied up.
 *
 * The profile stands at 5.0 from 15 reviews. GOOGLE_PROFILE below must match
 * it exactly: it is what the site displays and what the structured data
 * publishes to Google, and a figure that disagrees with the profile is the kind
 * of claim that gets a listing penalised.
 *
 * Reviews are shown, never linked. The owner asked for them to stay on the site
 * rather than send the reader out to Google.
 */

export interface Review {
  /** Reviewer's display name, exactly as it appears on Google. */
  author:   string;
  /** 1–5, as given. */
  rating:   number;
  /** Relative age shown on the profile, e.g. "2 weeks ago". */
  when:     string;
  /** The review text, verbatim. */
  text:     string;
  /**
   * True only where the review is on the public Google profile and has been
   * checked against it. Anything else must be false — the tick is a claim
   * about provenance, not decoration.
   */
  verified: boolean;
}

export const GOOGLE_PROFILE = {
  name:   "Elite Barcelona Transfer",
  rating: 5.0,
  /** Reviews on the profile. Update alongside the list below. */
  count:  15,
} as const;

export const REVIEWS: Review[] = [
  {
    author:   "licencia hub",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Excellent service! The driver was on time, waiting at the airport with my name sign, and the car was clean and comfortable. Great communication, fair price, and a smooth transfer to my hotel. Highly recommended, and I'll definitely use Elite BCN Transfers again",
    verified: true,
  },
];

/** Initials for the avatar circle, from the reviewer's own name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
