/**
 * The page a customer pays on, from what the website's booking handler returns.
 *
 * The website hands back a path (`/booking/pay/<checkout>?booking_id=...`) because its own pages open it in the same site. A phone
 * app opens it in a browser sheet and needs the whole address. Only the payment page counts: when SumUp is not set up or the checkout
 * could not be made, the handler returns the "booking received" page instead, and that is not a payment (the office arranges it).
 *
 * Returns the absolute payment-page address, or null when there is nothing to pay online.
 */
export function paymentPageUrl(raw: unknown, origin: string): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  const site = origin.replace(/\/$/, "");
  if (url.startsWith("/booking/pay/")) return `${site}${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.pathname.startsWith("/booking/pay/") && `${parsed.protocol}//${parsed.host}` === new URL(site).origin) return url;
    // A hosted page on another address (for example SumUp's own) is accepted as long as it is https.
    if (parsed.protocol === "https:" && !parsed.pathname.startsWith("/booking/success")) return url;
  } catch {
    /* not an address */
  }
  return null;
}
