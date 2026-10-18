/**
 * Where customers download the EliteBCN app.
 *
 * The apps are in review / closed testing until each store lists them for
 * everyone. A store link that is not public yet shows "not found" to a
 * customer, so the email only mentions the app when CUSTOMER_APP_PROMO=1.
 * Turn it on in the environment the day the apps are live; no code change.
 */
export const CUSTOMER_APP_LINKS = {
  android: "https://play.google.com/store/apps/details?id=info.elitebcn.customer",
  ios: "https://apps.apple.com/app/id6822434720",
} as const;

export function customerAppPromoEnabled(): boolean {
  return process.env.CUSTOMER_APP_PROMO === "1";
}
