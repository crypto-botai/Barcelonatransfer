/**
 * Apple Pay and Google Pay, through SumUp.
 *
 * Neither is something the code can switch on by itself. Both need the
 * merchant account onboarded in the SumUp dashboard under Settings > For
 * developers > Payment wallets, and Apple additionally needs every domain
 * that shows an Apple Pay button registered with Apple. Once that is done:
 *
 *   Google Pay appears when the widget is handed a merchantId and a
 *   merchantName, which is what GOOGLE_PAY below carries.
 *
 *   Apple Pay appears on its own, in browsers that support it, with no
 *   mount option at all. There is nothing to pass; it is either registered
 *   or it is not.
 *
 * WALLETS_ENABLED exists so the site does not advertise what it cannot do.
 * The checkout claimed "Apple Pay and Google Pay accepted" from the day it
 * was written, next to a form that offered neither.
 */

const merchantId = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID ?? "";
const merchantName = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_NAME ?? "Elite BCN Transfers";

/** Passed straight to SumUpCard.mount(); null when not configured. */
export const GOOGLE_PAY: { merchantId: string; merchantName: string } | null =
  merchantId ? { merchantId, merchantName } : null;

/**
 * Whether to tell customers that wallets are available.
 *
 * Set NEXT_PUBLIC_WALLETS_ENABLED=true once the SumUp dashboard onboarding
 * and the Apple domain registration are both done. Setting the Google Pay
 * merchant id alone also counts, since that half is then genuinely live.
 */
export const WALLETS_ENABLED =
  process.env.NEXT_PUBLIC_WALLETS_ENABLED === "true" || GOOGLE_PAY !== null;

/** The sentence to show, or null when there is nothing true to say. */
export const WALLET_LABEL = WALLETS_ENABLED ? "Apple Pay and Google Pay accepted" : null;
