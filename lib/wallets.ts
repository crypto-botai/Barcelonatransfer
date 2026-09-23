/**
 * Apple Pay and Google Pay, through SumUp.
 *
 * Neither is something the code can switch on by itself. Both need the
 * merchant account onboarded in the SumUp dashboard under Settings > For
 * developers > Electronic wallets, and Apple additionally needs every domain
 * that shows an Apple Pay button registered with Apple. Once that is done:
 *
 *   Google Pay appears when the widget is handed a merchantId and a
 *   merchantName, which is what GOOGLE_PAY below carries.
 *
 *   Apple Pay appears on its own, in browsers that support it, with no
 *   mount option at all. There is nothing to pass; the domain is either
 *   registered with Apple or it is not. APPLE_PAY_READY only controls
 *   whether we say so in writing.
 *
 * The two flags exist so the site does not advertise what it cannot do. The
 * checkout claimed "Apple Pay and Google Pay accepted" from the day it was
 * written, next to a form that offered neither.
 */

/**
 * The Google Pay merchant id, from the Google Pay & Wallet Console.
 *
 * Committed rather than kept in an environment variable because it is not a
 * secret: Google Pay puts it in the page source of every checkout that
 * offers the button, which is the whole point of it. The env var stays as an
 * override so it can be changed without a code change.
 */
const DEFAULT_GOOGLE_PAY_MERCHANT_ID = "BCR2DN6D5KZNHQDX";

const merchantId = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID ?? DEFAULT_GOOGLE_PAY_MERCHANT_ID;
const merchantName = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_NAME ?? "Elite BCN Transfers";

/**
 * Whether Google has approved the merchant for live payments.
 *
 * Until it has, the button renders but every tap ends in Google's own
 * "This merchant is having trouble accepting your payment [OR_BIBED_11]"
 * screen, which a customer reads as the site being broken. So the merchant
 * id is withheld from the widget, and the button with it, until the review
 * submitted on 21 Sep 2026 comes back approved. Flip the default then, or
 * set NEXT_PUBLIC_GOOGLE_PAY_APPROVED=true.
 */
export const GOOGLE_PAY_APPROVED = (process.env.NEXT_PUBLIC_GOOGLE_PAY_APPROVED ?? "false") === "true";

/** Passed straight to SumUpCard.mount(); null until configured and approved. */
export const GOOGLE_PAY: { merchantId: string; merchantName: string } | null =
  merchantId && GOOGLE_PAY_APPROVED ? { merchantId, merchantName } : null;

/**
 * Apple has verified the domain and SumUp has the wallet enabled.
 *
 * The domain association file was served, SumUp showed www.elitebcn.info as
 * verified, and the button rendered on a real iPhone checkout (confirmed by
 * the owner, 23 Sep 2026). Defaults on from then; set
 * NEXT_PUBLIC_APPLE_PAY_READY=false to take the sentence back off if Apple
 * or SumUp ever drops the domain.
 */
export const APPLE_PAY_READY = (process.env.NEXT_PUBLIC_APPLE_PAY_READY ?? "true") === "true";

/**
 * Google Pay has been seen rendering on a real checkout.
 *
 * Handing the widget a merchant id is not the same as the button appearing:
 * SumUp also has to enable the wallet on the merchant account, and until it
 * has, the form shows card fields only. A test booking on 21 Sep 2026 with a
 * live checkout and the id configured rendered no button; once the domain
 * was enabled in SumUp's Electronic wallets, the same checkout rendered it
 * (seen, screenshotted, 21 Sep 2026). Defaults on from then; the env var
 * can switch the sentence off again if SumUp ever disables it.
 */
export const GOOGLE_PAY_READY = GOOGLE_PAY !== null && (process.env.NEXT_PUBLIC_GOOGLE_PAY_READY ?? "true") === "true";

/** The sentence to show, or null when there is nothing true to say. */
export const WALLET_LABEL: string | null =
  APPLE_PAY_READY && GOOGLE_PAY_READY ? "Apple Pay and Google Pay accepted"
  : GOOGLE_PAY_READY ? "Google Pay accepted"
  : APPLE_PAY_READY ? "Apple Pay accepted"
  : null;

/** Kept for call sites that only ask whether to mention wallets at all. */
export const WALLETS_ENABLED = WALLET_LABEL !== null;
