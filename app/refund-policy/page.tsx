import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";
import { simpleBreadcrumb } from "@/lib/hub-schema";
import { PROTECTION_CUTOFF_HOURS } from "@/lib/checkout-money";
import { policySection, CANCELLATION_WINDOWS } from "@/lib/policies";

/**
 * The refund and cancellation policy, as a page of its own.
 *
 * It was a section of the Terms. It is linked from the checkout now, next to
 * the pay button, so it has to be readable in a minute on a phone: what comes
 * back, when, and how the deposit and the protection option change that. The
 * figures are the constants the checkout and the cancellation route run on,
 * so the page cannot drift from what the code actually refunds. The prose
 * itself lives in lib/policies.ts, shared with the Terms, the FAQ, the
 * checkout and the confirmation email.
 */

export const metadata: Metadata = {
  title: { absolute: "Refund & Cancellation Policy | Elite BCN Transfers" },
  description: "What is refunded when you cancel an Elite BCN transfer: free cancellation 24 hours before a city pickup, 48 hours outside the city, 72 hours for a minibus. Cancellation protection to 2 hours before, deposits, no-shows and how refunds are paid.",
  alternates: { canonical: "https://www.elitebcn.info/refund-policy" },
  openGraph: {
    ...SHARED_OG,
    title: "Refund & Cancellation Policy — Elite BCN Transfers",
    description: "Free cancellation 24 h in the city, 48 h beyond it, 72 h for a minibus. Cancellation protection holds your booking to 2 hours before pickup.",
    url: "https://www.elitebcn.info/refund-policy",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN Transfers — Refund Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Refund & Cancellation Policy — Elite BCN Transfers",
    description: "Free cancellation 24 h city, 48 h intercity, 72 h minibus. Protection holds it to 2 hours before.",
    images: ["/opengraph-image"],
  },
};

const BREADCRUMB = simpleBreadcrumb([{ name: "Refund Policy", path: "/refund-policy" }]);

export default function RefundPolicyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Legal</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Refund &amp; <span className="text-gold-gradient">Cancellation</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: 21 September 2026</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">

                {/* The short version, first. */}
                <div className="rounded-xl border border-gold-500/25 bg-gold-500/[0.05] p-5">
                  <h2 className="text-white font-display text-xl mb-3">In short</h2>
                  <ul className="space-y-2">
                    {CANCELLATION_WINDOWS.map((w) => <li key={w}>{w}</li>)}
                    <li><strong className="text-white">Inside that window the fare is not refunded.</strong> Message us on WhatsApp with proof of a cancelled flight or another serious reason and we will look at it case by case.</li>
                    <li><strong className="text-white">With cancellation protection</strong> your booking is held until {PROTECTION_CUTOFF_HOURS} hours before pickup and the fare is refunded in full. The protection fee itself is never refunded.</li>
                    <li><strong className="text-white">A delayed flight is never a cancellation.</strong> We track it and move your pickup at no charge.</li>
                  </ul>
                </div>

                {[policySection("cancellation"), policySection("protection"), policySection("deposit")].map((sec, i) => sec ? (
                  <div key={sec.id}>
                    <h2 className="text-white font-display text-xl mb-3">{i + 1}. {sec.heading}</h2>
                    {sec.lead && <p className="mb-2">{sec.lead}</p>}
                    <ul className="list-disc pl-5 space-y-1">
                      {sec.points.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                    {sec.note && <p className="mt-2 text-dark-400">{sec.note}</p>}
                  </div>
                ) : null)}

                <div>
                  <h2 className="text-white font-display text-xl mb-3">4. Changes rather than cancellations</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Changing the date, time, pickup or drop-off is free of charge when requested before your cancellation window closes, subject to availability. Reply to your confirmation email or message us on WhatsApp.</li>
                    <li>A change of destination is re-priced from the same fixed-price table; any difference is charged or refunded.</li>
                    <li>Flight delays are tracked automatically. A pickup moves with the flight at no charge, and airport pickups include 60 minutes of waiting from the actual landing time.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">5. Cancellations by Elite BCN</h2>
                  <p>In the rare event that we cannot provide the journey, we will tell you as early as possible and refund everything paid, including any protection fee, in full. Where possible we will offer an alternative vehicle or time first.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">6. How refunds are paid</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Refunds go back to the card used to pay, through our payment provider SumUp. They typically appear within 5 to 10 business days depending on your bank.</li>
                    <li>Bookings paid by bank transfer or in cash are refunded by bank transfer to an account you nominate.</li>
                    <li>You receive an email confirming the cancellation and the amount refunded.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">7. Contact</h2>
                  <p>
                    Questions about a refund: WhatsApp <a href={`https://wa.me/${COMPANY.phone.replace(/[^0-9]/g, "")}`} className="text-gold-400 hover:underline">{COMPANY.phoneDisplay}</a> or email <a href={`mailto:${COMPANY.email}`} className="text-gold-400 hover:underline">{COMPANY.email}</a>. This policy forms part of our <Link href="/terms" className="text-gold-400 hover:underline">Terms &amp; Conditions</Link>.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
