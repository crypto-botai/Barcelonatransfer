import { GOOGLE_PROFILE } from "@/data/reviews";

// Single source of truth for all facts, counts, and claims.
// Every component imports from here — zero hardcoded numbers elsewhere.

export const COMPANY = {
  legalName:    "Elite BCN Transfers",
  foundedYear:  2018,
  phone:        "+34635383712",
  phoneDisplay: "+34 635 383 712",
  whatsapp:     "https://wa.me/34635383712",
  /**
   * The mailbox that RECEIVES mail.
   * Gmail is the working fallback until bookings@elitebcn.info has verified MX records.
   * To switch: set NEXT_PUBLIC_CONTACT_EMAIL in Vercel. Zero code change needed.
   */
  email:        process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "vtcbcn2025@gmail.com",
  city:         "Barcelona",
  region:       "Catalonia",
  country:      "ES",
  vtcLicensed:  true,
};

export const SOCIAL_PROOF = {
  // Read from the reviews file rather than repeated here, so the rating shown
  // beside the reviews and the rating published in structured data cannot drift
  // apart. They already had: this said 4.9 from 312 while /about claimed 595,
  // and the real profile holds 5.0 from 15.
  google:      { rating: GOOGLE_PROFILE.rating, count: GOOGLE_PROFILE.count },
  // Trustpilot and TripAdvisor: include only after confirming live profiles exist.
  // Re-add and update COMPANY_FACTS.totalReviewCount once verified.
} as const;

// Functions so they recompute if counts change
export function totalReviews(): number {
  return SOCIAL_PROOF.google.count;
}

export function yearsActive(): number {
  return new Date().getFullYear() - COMPANY.foundedYear;
}

export const OPERATIONS = {
  transfersCompleted: 5000,
  transfersDisplay:   "5,000+",
  onTimeGuarantee:    "100%",
  supportHours:       "24/7",
} as const;

// Legacy alias kept for backward compatibility with HeroSection and others.
export const COMPANY_FACTS = {
  foundedYear:         COMPANY.foundedYear,
  yearsInBusiness:     yearsActive(),
  totalTransfers:      OPERATIONS.transfersCompleted,
  googleReviewCount:   SOCIAL_PROOF.google.count,
  totalReviewCount:    totalReviews(),
  rating:              SOCIAL_PROOF.google.rating,
  // toFixed(1) so a whole number keeps its decimal: `${5.0}` renders as
  // "5" in a template literal, and "5★" reads as a rounded-up 4.5.
  ratingDisplay:       `${SOCIAL_PROOF.google.rating.toFixed(1)}★`,
  transfersDisplay:    OPERATIONS.transfersDisplay,
  yearsDisplay:        `${yearsActive()}+`,
  totalReviewsDisplay: `${totalReviews()}`,
} as const;
