import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";
import { simpleBreadcrumb } from "@/lib/hub-schema";
import { policySection } from "@/lib/policies";

/** One policy section from lib/policies.ts, numbered for the Terms. */
function Section({ id, n }: { id: string; n: number }) {
  const sec = policySection(id);
  if (!sec) return null;
  return (
    <div>
      <h2 className="text-white font-display text-xl mb-3">{n}. {sec.heading}</h2>
      {sec.lead && <p className="mb-2">{sec.lead}</p>}
      <ul className="list-disc pl-5 space-y-1">
        {sec.points.map((p) => <li key={p}>{p}</li>)}
      </ul>
      {sec.note && <p className="mt-2 text-dark-400">{sec.note}</p>}
    </div>
  );
}

export const metadata: Metadata = {
  title: { absolute: "Terms & Conditions | Elite BCN Transfers" },
  description: "Terms and Conditions for Elite BCN Transfers — the Barcelona luxury private chauffeur and airport transfer service.",
  alternates: { canonical: "https://www.elitebcn.info/terms" },
  openGraph: {
    ...SHARED_OG,
    title: "Terms & Conditions — Elite BCN Barcelona Private Transfers",
    description: "Terms and Conditions for Elite BCN Transfers — Barcelona luxury private chauffeur service.",
    url: "https://www.elitebcn.info/terms",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN Transfers — Terms & Conditions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms & Conditions — Elite BCN Barcelona Private Transfers",
    description: "Terms and Conditions for Elite BCN Transfers — Barcelona luxury private chauffeur service.",
    images: ["/opengraph-image"],
  },
};

// This page sits under the root and never said so. Thirteen pages had no
// BreadcrumbList; eight were homepages, which correctly need none.
const BREADCRUMB = simpleBreadcrumb([{ name: "Terms of Service", path: "/terms" }]);

export default function TermsPage() {
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
              Terms & <span className="text-gold-gradient">Conditions</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: 20 September 2026</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">

                <div>
                  <h2 className="text-white font-display text-xl mb-3">1. Agreement</h2>
                  <p>By booking a service with Elite BCN Transfers (&quot;the Company&quot;), you (&quot;the Client&quot;) agree to be bound by these Terms and Conditions. These terms apply to all bookings made via our website, WhatsApp, phone, or email.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">2. Bookings & Confirmation</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>A booking is confirmed only upon receipt of a written confirmation email from us.</li>
                    <li>We recommend booking at least 24 hours in advance. Bookings made less than 4 hours before pickup carry a 15% last-minute surcharge, and we cannot accept a booking with less than 1 hour&apos;s notice.</li>
                    <li>You are responsible for providing accurate pick-up address, destination, date, time, flight number and passenger details. A journey that cannot be made because the details given were wrong is treated as a no-show.</li>
                    <li>Tell us when you book if you are travelling with a child of 135 cm or under, with a pet, or with more luggage than the vehicle is listed to carry. See sections 8 and 9.</li>
                    <li>Any changes to a confirmed booking must be requested as early as possible and are subject to availability.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">3. Pricing & Payment</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>All prices are fixed per vehicle and <strong>exclude VAT and motorway tolls</strong>. Quoted fares include the chauffeur, vehicle, fuel and parking. Spanish VAT at 10% is added to the fare only where the client requests an invoice; motorway tolls are charged separately on routes that use them.</li>
                    <li>A 20% night surcharge applies to journeys commencing between 22:00 and 06:00.</li>
                    <li>Payment is accepted by credit/debit card via SumUp, bank transfer, or cash by prior arrangement.</li>
                    <li>At the checkout you may pay the full fare, or a 30% deposit with the remaining 70% paid to your chauffeur at the end of the journey in cash or by card. Both amounts are shown before you pay and on your confirmation.</li>
                    <li>Cancellation protection is an optional add-on priced at 20% of the fare. It extends free cancellation to 2 hours before pickup; the fee itself is not refundable. See the <a href="/refund-policy" className="text-gold-400 hover:underline">Refund &amp; Cancellation Policy</a>.</li>
                    <li>Payment must be completed before or at the time of travel unless a corporate account has been established.</li>
                  </ul>
                </div>

                <Section id="cancellation" n={4} />

                <Section id="protection" n={5} />

                <div>
                  <h2 className="text-white font-display text-xl mb-3">6. Refunds</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Refunds are returned to the card used to pay and normally appear within 5 to 10 business days, depending on your bank.</li>
                    <li>On a deposit booking these rules apply to the amount actually paid; a cancellation inside the window, or a no-show, forfeits the deposit.</li>
                    <li>The full policy, including changes and refunds by bank transfer, is at <a href="/refund-policy" className="text-gold-400 hover:underline">elitebcn.info/refund-policy</a>.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">7. Waiting Time</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Airport pick-ups include 60 minutes of free waiting time from the actual flight landing time.</li>
                    <li>Non-airport pick-ups include 15 minutes of free waiting time from the scheduled pickup time.</li>
                    <li>Additional waiting time is charged at €25 per 30 minutes.</li>
                  </ul>
                </div>

                <Section id="meet-greet" n={8} />

                <div>
                  <h2 className="text-white font-display text-xl mb-3">9. Passenger Conduct</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>All passengers must wear seatbelts at all times.</li>
                    <li>Smoking, including e-cigarettes, is strictly prohibited in all vehicles.</li>
                    <li>Consumption of food is not permitted. Drinks in sealed containers are allowed.</li>
                    <li>The Client is liable for any damage to the vehicle caused by the passenger group. A cleaning fee of €150–€500 may be charged for soiling.</li>
                    <li>The driver reserves the right to refuse or terminate a journey if passenger behaviour is deemed unsafe or abusive.</li>
                  </ul>
                </div>

                <Section id="luggage" n={10} />

                <Section id="children" n={11} />

                <div>
                  <h2 className="text-white font-display text-xl mb-3">12. Liability</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The Company holds full professional passenger liability insurance.</li>
                    <li>The Company is not liable for delays caused by traffic, road closures, adverse weather, or other circumstances beyond our control.</li>
                    <li>The Company is not liable for missed flights, trains, or events due to such delays.</li>
                    <li>Our maximum liability is limited to the amount paid for the affected journey.</li>
                    <li>Luggage is loaded and unloaded by the chauffeur. Where the Client insists on handling luggage themselves, the Company&apos;s insurance does not cover damage, loss, or injury arising from it.</li>
                    <li>The Company accepts no liability for loss of or damage to luggage unless caused by proven negligence of the chauffeur.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">13. Complaints</h2>
                  <p>Any complaints must be submitted in writing within 7 days of the journey to {COMPANY.email}. We aim to respond within 48 hours.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">14. Governing Law</h2>
                  <p>These Terms are governed by the laws of Spain. Any disputes shall be subject to the jurisdiction of the courts of Barcelona.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">15. Contact</h2>
                  <p>Elite BCN Transfers · Barcelona, Spain · <a href={`mailto:${COMPANY.email}`} className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">{COMPANY.email}</a> · +34 635 383 712</p>
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
