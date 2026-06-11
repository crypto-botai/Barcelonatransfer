import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Élite BCN — 24/7 Luxury Transfer Support Barcelona",
  description:
    "Contact Élite BCN Transfers for bookings, support, or enquiries. Available 24/7 by phone, WhatsApp, or email. Barcelona's premier private chauffeur service.",
  alternates: { canonical: "https://www.elitebcn.info/contact" },
  openGraph: {
    title: "Contact Élite BCN — 24/7 Support",
    description: "Reach our team 24/7 by phone, WhatsApp, or email. Barcelona luxury private transfer specialists.",
    url: "https://www.elitebcn.info/contact",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Contact Élite BCN Transfers" }],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
