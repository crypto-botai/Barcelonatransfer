import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Élite BCN Transfers — how we collect, use and protect your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Legal</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Privacy <span className="text-gold-gradient">Policy</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: May 2025</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 prose prose-invert prose-gold max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">

                <div>
                  <h2 className="text-white font-display text-xl mb-3">1. Who We Are</h2>
                  <p>Élite BCN Transfers (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a licensed VTC operator based in Barcelona, Spain. We operate the website elitebcn.info and provide luxury private chauffeur services. Contact: vtcbcn2025@gmail.com · +34 635 383 712.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">2. Data We Collect</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">Booking data:</strong> name, email, phone number, pick-up/drop-off addresses, travel date and time, passenger count, flight number.</li>
                    <li><strong className="text-white">Payment data:</strong> we do not store card details — payments are processed by SumUp, a PCI-DSS compliant provider.</li>
                    <li><strong className="text-white">Account data:</strong> if you register, we store your name, email, and hashed password.</li>
                    <li><strong className="text-white">Usage data:</strong> IP address, browser type, pages visited, referring URLs — collected via standard server logs.</li>
                    <li><strong className="text-white">Communications:</strong> emails or WhatsApp messages you send us.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">3. How We Use Your Data</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>To fulfil your booking and communicate with you about it.</li>
                    <li>To send booking confirmation and driver-assignment emails.</li>
                    <li>To process payments via SumUp.</li>
                    <li>To comply with Spanish and EU legal obligations.</li>
                    <li>To improve our service (aggregated, anonymised analytics only).</li>
                  </ul>
                  <p className="mt-3">We never sell your data to third parties. We do not use your data for marketing without explicit consent.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">4. Legal Basis (GDPR)</h2>
                  <p>We process your data on the following lawful bases:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">Contract performance</strong> — to process your booking.</li>
                    <li><strong className="text-white">Legitimate interests</strong> — to prevent fraud and improve our service.</li>
                    <li><strong className="text-white">Legal obligation</strong> — to comply with tax and transport regulations.</li>
                    <li><strong className="text-white">Consent</strong> — for optional marketing communications.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">5. Data Retention</h2>
                  <p>Booking records are retained for 7 years in accordance with Spanish commercial law. Account data is retained until you request deletion. Server logs are kept for 30 days.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">6. Your Rights</h2>
                  <p>Under GDPR you have the right to: access, rectify, erase, restrict processing of, and port your personal data. You may also object to processing and withdraw consent at any time. To exercise these rights, contact vtcbcn2025@gmail.com. You have the right to lodge a complaint with the Spanish Data Protection Agency (AEPD) at aepd.es.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">7. Third-Party Services</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="text-white">SumUp</strong> — payment processing (GDPR compliant, PCI-DSS certified)</li>
                    <li><strong className="text-white">Resend</strong> — transactional email delivery</li>
                    <li><strong className="text-white">Supabase / Vercel</strong> — database and hosting (EU data centres where applicable)</li>
                    <li><strong className="text-white">Google Maps</strong> — address autocomplete on the booking form</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">8. Cookies</h2>
                  <p>We use essential session cookies for authentication and functionality. See our <a href="/cookies" className="text-gold-400 hover:text-gold-300 underline">Cookie Policy</a> for full details.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">9. Changes to This Policy</h2>
                  <p>We may update this policy from time to time. The &quot;last updated&quot; date at the top will reflect any changes. Continued use of our service constitutes acceptance of the revised policy.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">10. Contact</h2>
                  <p>For any privacy-related queries: <a href="mailto:vtcbcn2025@gmail.com" className="text-gold-400 hover:text-gold-300">vtcbcn2025@gmail.com</a></p>
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
