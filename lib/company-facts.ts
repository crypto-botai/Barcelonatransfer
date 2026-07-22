// Single source of truth for all facts, counts, and claims.
// Every component imports from here — zero hardcoded numbers elsewhere.

export const COMPANY = {
  legalName:    "Élite BCN Transfers",
  foundedYear:  2018,
  phone:        "+34635383712",
  phoneDisplay: "+34 635 383 712",
  whatsapp:     "https://wa.me/34635383712",
  // TODO: create mailbox and forward in domain registrar (bookings@elitebcn.info → your inbox)
  email:        "bookings@elitebcn.info",
  city:         "Barcelona",
  country:      "ES",
  vtcLicensed:  true,
} as const;

export const SOCIAL_PROOF = {
  googleRating:           4.9,
  googleReviewCount:      312,
  trustpilotRating:       4.8,
  trustpilotReviewCount:  189,
  tripadvisorRating:      5.0,
  tripadvisorReviewCount: 94,
} as const;

// Derived — never hardcode downstream
export const TOTAL_REVIEWS = (
  SOCIAL_PROOF.googleReviewCount +
  SOCIAL_PROOF.trustpilotReviewCount +
  SOCIAL_PROOF.tripadvisorReviewCount
); // 595

export const YEARS_ACTIVE = new Date().getFullYear() - COMPANY.foundedYear;

export const OPERATIONS = {
  transfersCompleted: 5000,
  transfersDisplay:   "5,000+",
  onTimeGuarantee:    "100%",
  supportHours:       "24/7",
} as const;

// Legacy alias kept for backward compatibility
export const COMPANY_FACTS = {
  foundedYear:         COMPANY.foundedYear,
  yearsInBusiness:     YEARS_ACTIVE,
  totalTransfers:      OPERATIONS.transfersCompleted,
  googleReviewCount:   SOCIAL_PROOF.googleReviewCount,
  totalReviewCount:    TOTAL_REVIEWS,
  rating:              SOCIAL_PROOF.googleRating,
  ratingDisplay:       `${SOCIAL_PROOF.googleRating}★`,
  transfersDisplay:    OPERATIONS.transfersDisplay,
  yearsDisplay:        `${YEARS_ACTIVE}+`,
  totalReviewsDisplay: `${TOTAL_REVIEWS}`,
} as const;
