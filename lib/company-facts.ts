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
  google:      { rating: 4.9, count: 312 },
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

// Legacy alias kept for backward compatibility with HeroSection, StatsSection, etc.
export const COMPANY_FACTS = {
  foundedYear:         COMPANY.foundedYear,
  yearsInBusiness:     yearsActive(),
  totalTransfers:      OPERATIONS.transfersCompleted,
  googleReviewCount:   SOCIAL_PROOF.google.count,
  totalReviewCount:    totalReviews(),
  rating:              SOCIAL_PROOF.google.rating,
  ratingDisplay:       `${SOCIAL_PROOF.google.rating}★`,
  transfersDisplay:    OPERATIONS.transfersDisplay,
  yearsDisplay:        `${yearsActive()}+`,
  totalReviewsDisplay: `${totalReviews()}`,
} as const;
