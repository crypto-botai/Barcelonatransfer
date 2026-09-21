import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";
import { simpleBreadcrumb } from "@/lib/hub-schema";
import { DEPOSIT_PERCENT, PROTECTION_PERCENT, PROTECTION_CUTOFF_HOURS, FREE_CANCEL_HOURS } from "@/lib/checkout-money";

/**
 * The refund and cancellation policy, as a page of its own.
 *
 * It was a section of the Terms. It is linked from the checkout now, next to
 * the pay button, so it has to be readable in a minute on a phone: what comes
 * back, when, and how the deposit and the protection option change that. The
 * figures are the constants the checkout and the cancellation route run on,
 * so the page cannot drift from what the code actually refunds.
 */

export const metadata: Metadata = {
  title: { absolute: "Refund & Cancellation Policy | Elite BCN Transfers" },
  description: "What is refunded when you cancel an Elite BCN transfer: free cancellation up to 24 hours before pickup, cancellation protection to 2 hours before, deposits, no-shows and processing times.",
  alternates: { canonical: "https://www.elitebcn.info/refund-policy" },
  openGraph: {
    ...SHARED_OG,
    title: "Refund & Cancellation Policy — Elite BCN Transfers",
    description: "Free cancellation up to 24 hours before pickup. Cancellation protection to 2 hours before. Deposits, no-shows and refund times explained.",
    url: "https://www.elitebcn.info/refund-policy",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN Transfers — Refund Policy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Refund & Cancellation Policy — Elite BCN Transfers",
    description: "Free cancellation up to 24 hours before pickup. Cancellation protection to 2 hours before.",
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
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: 20 September 2026</p>
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
                    <li><strong className="text-white">More than {FREE_CANCEL_HOURS} hours before pickup:</strong> cancel from your confirmation email or your account and everything you paid comes back, automatically.</li>
                    <li><strong className="text-white">With cancellation protection:</strong> the same, up to {PROTECTION_CUTOFF_HOURS} hours before pickup. Only the protection fee is kept.</li>
                    <li><strong className="text-white">Flight delays are never a cancellation.</strong> We track the flight and wait; there is nothing to cancel and nothing to pay.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">1. Cancelling without protection</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">More than {FREE_CANCEL_HOURS} hours before pickup:</strong> full refund of everything paid online.</li>
                    <li><strong className="text-white">Between {PROTECTION_CUTOFF_HOURS} and {FREE_CANCEL_HOURS} hours before pickup:</strong> a 50% cancellation charge applies. Inside this window the cancellation is handled by our team: contact us on WhatsApp or by email and we arrange the refund of the remaining 50%.</li>
                    <li><strong className="text-white">Less than {PROTECTION_CUTOFF_HOURS} hours before pickup, or no-show:</strong> the full fare is charged. A chauffeur has already been dispatched.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">2. Cancellation protection</h2>
                  <p className="mb-2">Cancellation protection is an optional add-on offered at the checkout, priced at {PROTECTION_PERCENT}% of the fare. It is shown as a separate line before you pay.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>With protection you may cancel up to <strong className="text-white">{PROTECTION_CUTOFF_HOURS} hours before pickup</strong> for a full refund of the fare, from your confirmation email or your account, with no need to contact us.</li>
                    <li>The protection fee itself is <strong className="text-white">not refundable</strong> in any circumstance. It is the price of the flexibility.</li>
                    <li>Inside the final {PROTECTION_CUTOFF_HOURS} hours, or on a no-show, the full fare is charged as in section 1.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">3. Deposits</h2>
                  <p className="mb-2">At the checkout you may pay {DEPOSIT_PERCENT}% of the fare as a deposit and the remainder to your chauffeur at the end of the journey, in cash or by card.</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The rules above apply to what has actually been paid. A cancellation more than {FREE_CANCEL_HOURS} hours before pickup refunds the deposit in full; with protection, the deposit less the protection fee, up to {PROTECTION_CUTOFF_HOURS} hours before.</li>
                    <li>A no-show or a cancellation inside the charged window forfeits the deposit. Where the fare exceeds the deposit, the balance may be invoiced.</li>
                    <li>Cancellation protection on a deposit booking is always paid in full with the deposit.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">4. Changes rather than cancellations</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Changing the date, time, pickup or drop-off of a booking is free of charge when requested more than {FREE_CANCEL_HOURS} hours before pickup, subject to availability. Reply to your confirmation email or contact us on WhatsApp.</li>
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
