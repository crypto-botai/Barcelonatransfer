import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});

export async function createCheckoutSession({
  bookingId,
  amount,
  currency = "eur",
  customerEmail,
  description,
  metadata,
}: {
  bookingId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    payment_method_options: {
      card: { request_three_d_secure: "automatic" },
    },
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "Élite BCN — Luxury Transfer",
            description,
            images: ["https://elitebcntransfers.com/og-image.jpg"],
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: customerEmail,
    success_url: `${process.env.NEXTAUTH_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/booking/failed?booking_id=${bookingId}`,
    metadata: { bookingId, ...metadata },
    payment_intent_data: { metadata: { bookingId, ...metadata } },
  });

  return session;
}
