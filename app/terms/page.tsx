import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and Conditions for Élite BCN Transfers luxury chauffeur service.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Legal</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Terms & <span className="text-gold-gradient">Conditions</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: May 2025</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">

                <div>
                  <h2 className="text-white font-display text-xl mb-3">1. Agreement</h2>
                  <p>By booking a service with Élite BCN Transfers (&quot;the Company&quot;), you (&quot;the Client&quot;) agree to be bound by these Terms and Conditions. These terms apply to all bookings made via our website, WhatsApp, phone, or email.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">2. Bookings & Confirmation</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>A booking is confirmed only upon receipt of a written confirmation email from us.</li>
                    <li>We recommend booking at least 24 hours in advance. Last-minute bookings are subject to availability.</li>
                    <li>You are responsible for providing accurate pick-up address, destination, date, time, and passenger details.</li>
                    <li>Any changes to a confirmed booking must be requested as early as possible and are subject to availability.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">3. Pricing & Payment</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>All prices are fixed and inclusive of VAT, tolls, fuel, and parking unless stated otherwise.</li>
                    <li>A 20% night surcharge applies to journeys commencing between 22:00 and 06:00.</li>
                    <li>Payment is accepted by credit/debit card via SumUp, bank transfer, or cash by prior arrangement.</li>
                    <li>Payment must be completed before or at the time of travel unless a corporate account has been established.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">4. Cancellation Policy</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">More than 24 hours before pickup:</strong> Full refund.</li>
                    <li><strong className="text-white">Between 2 and 24 hours before pickup:</strong> 50% cancellation charge.</li>
                    <li><strong className="text-white">Less than 2 hours before pickup / no-show:</strong> 100% charge.</li>
                    <li>Flight delays are NOT considered cancellations — we track all flights in real time and adjust accordingly at no extra charge.</li>
                    <li>Refunds will be processed within 5–10 business days to the original payment method.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">5. Waiting Time</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Airport pick-ups include 60 minutes of free waiting time from the actual flight landing time.</li>
                    <li>Non-airport pick-ups include 15 minutes of free waiting time from the scheduled pickup time.</li>
                    <li>Additional waiting time is charged at €25 per 30 minutes.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">6. Passenger Conduct</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>All passengers must wear seatbelts at all times.</li>
                    <li>Smoking, including e-cigarettes, is strictly prohibited in all vehicles.</li>
                    <li>Consumption of food is not permitted. Drinks in sealed containers are allowed.</li>
                    <li>The Client is liable for any damage to the vehicle caused by the passenger group. A cleaning fee of €150–€500 may be charged for soiling.</li>
                    <li>The driver reserves the right to refuse or terminate a journey if passenger behaviour is deemed unsafe or abusive.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">7. Luggage</h2>
                  <p>Standard luggage allowances apply per vehicle class. The Company accepts no liability for loss of or damage to luggage unless caused by proven negligence of the driver.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">8. Liability</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The Company holds full professional passenger liability insurance.</li>
                    <li>The Company is not liable for delays caused by traffic, road closures, adverse weather, or other circumstances beyond our control.</li>
                    <li>The Company is not liable for missed flights, trains, or events due to such delays.</li>
                    <li>Our maximum liability is limited to the amount paid for the affected journey.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">9. Complaints</h2>
                  <p>Any complaints must be submitted in writing within 7 days of the journey to vtcbcn2025@gmail.com. We aim to respond within 48 hours.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">10. Governing Law</h2>
                  <p>These Terms are governed by the laws of Spain. Any disputes shall be subject to the jurisdiction of the courts of Barcelona.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">11. Contact</h2>
                  <p>Élite BCN Transfers · Barcelona, Spain · <a href="mailto:vtcbcn2025@gmail.com" className="text-gold-400 hover:text-gold-300">vtcbcn2025@gmail.com</a> · +34 635 383 712</p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
