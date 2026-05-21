const SUMUP_API = "https://api.sumup.com";

export interface SumUpCheckout {
  id: string;
  checkout_reference: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  return_url?: string;
  date?: string;
  transaction_id?: string;
}

export async function createSumUpCheckout({
  bookingId,
  amount,
  currency = "EUR",
  description,
  customerEmail,
}: {
  bookingId: string;
  amount: number;
  currency?: string;
  description: string;
  customerEmail?: string;
}): Promise<SumUpCheckout> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info";
  // Remove trailing slash and ensure production URL
  const cleanBase = baseUrl.replace(/\/$/, "").replace("http://localhost:3000", "https://www.elitebcn.info");

  // Truncate description to 100 chars max (SumUp limit)
  const safeDesc = description
    .replace(/[^\x00-\x7F]/g, (c) => {
      // keep common accented chars, replace rare ones
      const map: Record<string, string> = { "→": "->", "←": "<-", "É": "E", "é": "e", "à": "a", "ó": "o", "ú": "u", "í": "i", "ñ": "n" };
      return map[c] ?? c;
    })
    .slice(0, 100);

  const body: Record<string, unknown> = {
    checkout_reference: bookingId,
    amount: Math.round(amount * 100) / 100,
    currency: currency.toUpperCase(),
    description: safeDesc,
    merchant_code: process.env.SUMUP_MERCHANT_CODE,
    return_url: `${cleanBase}/booking/success?booking_id=${bookingId}`,
    redirect_url: `${cleanBase}/booking/success?booking_id=${bookingId}`,
  };

  if (customerEmail) body.customer_email = customerEmail;

  const response = await fetch(`${SUMUP_API}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUMUP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SumUp checkout creation failed (${response.status}): ${text}`);
  }

  return response.json();
}

export async function getSumUpCheckout(checkoutId: string): Promise<SumUpCheckout> {
  const response = await fetch(`${SUMUP_API}/v0.1/checkouts/${checkoutId}`, {
    headers: {
      Authorization: `Bearer ${process.env.SUMUP_API_KEY}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`SumUp checkout fetch failed (${response.status})`);
  }

  return response.json();
}

export function getSumUpCheckoutUrl(checkoutId: string): string {
  return `https://checkout.sumup.com/checkout/${checkoutId}`;
}
