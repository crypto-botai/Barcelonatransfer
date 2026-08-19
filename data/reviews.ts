/**
 * Real Google reviews, transcribed from the Elite Barcelona Transfer profile.
 *
 * This file replaced six invented testimonials — names and cities that were
 * never customers. Nothing may be added here that is not on the live Google
 * profile, and the wording is the reviewer's own: spelling, capitalisation and
 * emoji as written, not tidied up.
 *
 * Where Google shows a review translated from Spanish, French or Norwegian, the
 * English Google gives is what appears here, since that is what a reader of
 * this site would have seen on the profile.
 *
 * GOOGLE_PROFILE must match the profile exactly. It no longer appears on the
 * page — the owner asked for the reviews to speak for themselves — but it caps
 * how many may be listed and it feeds the AggregateRating structured data,
 * where the figure has to be accurate.
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
  /** google.com/maps?cid=… — the profile these reviews come from. */
  cid:    "8610295895899713122",
  rating: 5.0,
  /** Reviews on the profile. Update alongside the list below. */
  count:  15,
} as const;

export const REVIEWS: Review[] = [
  {
    author:   "Bilal Irfan",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Fantastic experience! Booking was simple, the driver arrived on time, and the transfer was smooth and comfortable. Great value for money and excellent customer service. Highly recommended!",
    verified: true,
  },
  {
    author:   "Mr.sheikh Sk",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Great service from start to finish. The driver was polite, the car was spotless, and everything was on time. Very competitive prices and excellent communication. Highly recommended!",
    verified: true,
  },
  {
    author:   "licencia hub",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Excellent service! The driver was on time, waiting at the airport with my name sign, and the car was clean and comfortable. Great communication, fair price, and a smooth transfer to my hotel. Highly recommended, and I'll definitely use Elite BCN Transfers again",
    verified: true,
  },
  {
    author:   "Tooba Idrees",
    rating:   5,
    when:     "2 weeks ago",
    text:     "It's very good and they have excellent service",
    verified: true,
  },
  {
    author:   "Husna Nouman",
    rating:   5,
    when:     "2 months ago",
    text:     "very useful, highly recommend 👍👍👍👍👍",
    verified: true,
  },
  {
    author:   "pay pal",
    rating:   5,
    when:     "2 months ago",
    text:     "Very nice and clean service. Up on time thanks",
    verified: true,
  },
  {
    author:   "ZaiD T",
    rating:   5,
    when:     "5 days ago",
    text:     "Really good service. On time, clean car and very professional driver. Everything went smoothly. Would definitely use Elite BCN again.",
    verified: true,
  },
  {
    author:   "Zohaib Kayani",
    rating:   5,
    when:     "5 days ago",
    text:     "Very reliable service. The driver arrived early, the car was clean, and the ride was comfortable. No stress at all. Highly recommended.",
    verified: true,
  },
  {
    author:   "Raja Zain",
    rating:   5,
    when:     "5 days ago",
    text:     "Excellent service, very punctual and comfortable. The driver was friendly and professional. Everything was easy and smooth. Highly recommended!",
    verified: true,
  },
  {
    // Google shows this one translated from Norwegian.
    author:   "Miral Musa",
    rating:   5,
    when:     "5 days ago",
    text:     "Very happy with the service! Punctual driver, clean car and a comfortable ride. Everything went very smoothly. Recommended.",
    verified: true,
  },
  {
    // Translated from French.
    author:   "Mr Nomi",
    rating:   5,
    when:     "5 days ago",
    text:     "Excellent service! The driver was punctual, friendly, and the car was very clean. Everything went perfectly. I highly recommend them!",
    verified: true,
  },
  {
    // Translated from Spanish.
    author:   "Hamayun Rafqat",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Very reliable and professional service. Easy booking, great communication, and the driver was friendly and punctual. Everything went exactly as promised. I would definitely recommend Elite BCN Transfers to anyone visiting Barcelona.",
    verified: true,
  },
  {
    // Translated from Spanish.
    author:   "Arshad Muhammad",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Excellent service and very professional. The booking was quick, the driver was friendly and punctual, and the trip was very comfortable. Highly recommended. I will definitely book again!",
    verified: true,
  },
  {
    // Translated from Spanish. The emoji is the reviewer's own.
    author:   "Maryam",
    rating:   5,
    when:     "2 weeks ago",
    text:     "Very good experience and it arrived on time 🚗",
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
