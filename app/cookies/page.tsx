import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie Policy for Élite BCN Transfers — how we use cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Legal</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Cookie <span className="text-gold-gradient">Policy</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">Last updated: May 2025</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">

                <div>
                  <h2 className="text-white font-display text-xl mb-3">What Are Cookies?</h2>
                  <p>Cookies are small text files placed on your device when you visit a website. They help websites function correctly, remember your preferences, and gather analytical information.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">Cookies We Use</h2>

                  <div className="space-y-5 mt-4">
                    <div className="border border-white/[0.06] rounded-xl p-5">
                      <h3 className="text-gold-400 font-semibold mb-2">Essential Cookies</h3>
                      <p className="mb-3">These cookies are necessary for the website to function. They cannot be disabled.</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="text-left py-2 text-dark-400 font-medium">Cookie</th>
                            <th className="text-left py-2 text-dark-400 font-medium">Purpose</th>
                            <th className="text-left py-2 text-dark-400 font-medium">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="space-y-1">
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-2 text-white font-mono">next-auth.session-token</td>
                            <td className="py-2">Keeps you logged in securely</td>
                            <td className="py-2">30 days</td>
                          </tr>
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-2 text-white font-mono">next-auth.csrf-token</td>
                            <td className="py-2">Prevents cross-site request forgery</td>
                            <td className="py-2">Session</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-white font-mono">next-auth.callback-url</td>
                            <td className="py-2">Remembers where to redirect after login</td>
                            <td className="py-2">Session</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-white/[0.06] rounded-xl p-5">
                      <h3 className="text-gold-400 font-semibold mb-2">Functional Cookies</h3>
                      <p className="mb-3">These enhance your experience but are not strictly necessary.</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="text-left py-2 text-dark-400 font-medium">Cookie</th>
                            <th className="text-left py-2 text-dark-400 font-medium">Purpose</th>
                            <th className="text-left py-2 text-dark-400 font-medium">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 text-white font-mono">booking-form</td>
                            <td className="py-2">Saves partial booking form state</td>
                            <td className="py-2">1 day</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-white/[0.06] rounded-xl p-5">
                      <h3 className="text-gold-400 font-semibold mb-2">Third-Party Cookies</h3>
                      <p className="mb-3">Set by external services we use.</p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="text-left py-2 text-dark-400 font-medium">Provider</th>
                            <th className="text-left py-2 text-dark-400 font-medium">Purpose</th>
                            <th className="text-left py-2 text-dark-400 font-medium">More Info</th>
                          </tr>
                        </thead>
                        <tbody className="space-y-1">
                          <tr className="border-b border-white/[0.04]">
                            <td className="py-2 text-white">Google Maps</td>
                            <td className="py-2">Address autocomplete on booking form</td>
                            <td className="py-2"><a href="https://policies.google.com/privacy" className="text-gold-400 hover:text-gold-300" target="_blank" rel="noreferrer">Google Privacy</a></td>
                          </tr>
                          <tr>
                            <td className="py-2 text-white">SumUp</td>
                            <td className="py-2">Secure payment processing</td>
                            <td className="py-2"><a href="https://sumup.com/privacy/" className="text-gold-400 hover:text-gold-300" target="_blank" rel="noreferrer">SumUp Privacy</a></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">Managing Cookies</h2>
                  <p>You can control cookies through your browser settings. Note that disabling essential cookies will prevent you from logging in or completing bookings.</p>
                  <ul className="list-disc pl-5 space-y-1 mt-3">
                    <li><a href="https://support.google.com/chrome/answer/95647" className="text-gold-400 hover:text-gold-300" target="_blank" rel="noreferrer">Chrome cookie settings</a></li>
                    <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" className="text-gold-400 hover:text-gold-300" target="_blank" rel="noreferrer">Firefox cookie settings</a></li>
                    <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471" className="text-gold-400 hover:text-gold-300" target="_blank" rel="noreferrer">Safari cookie settings</a></li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">Contact</h2>
                  <p>If you have questions about our use of cookies, please contact us at <a href="mailto:vtcbcn2025@gmail.com" className="text-gold-400 hover:text-gold-300">vtcbcn2025@gmail.com</a>.</p>
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
