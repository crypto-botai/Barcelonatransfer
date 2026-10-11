import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Delete your account | Elite BCN Transfers" },
  description: "How to delete your Elite BCN account and personal data from the EliteBCN app or by email, and what we keep.",
  alternates: { canonical: "https://www.elitebcn.info/delete-account" },
  openGraph: {
    ...SHARED_OG,
    title: "Delete your account — Elite BCN Transfers",
    description: "How to delete your Elite BCN account and personal data, and what we keep.",
    url: "https://www.elitebcn.info/delete-account",
  },
};

export default function DeleteAccountPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Account</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Delete your <span className="text-gold-gradient">account</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">For the EliteBCN app and the Elite BCN website.</p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="glass-card rounded-2xl p-8 sm:p-12 prose prose-invert prose-gold max-w-none">
              <div className="space-y-8 text-dark-300 text-sm leading-relaxed">
                <div>
                  <h2 className="text-white font-display text-xl mb-3">In the app</h2>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Open the EliteBCN app and sign in.</li>
                    <li>Go to Profile, then Settings.</li>
                    <li>Choose Delete account, enter your password and confirm.</li>
                  </ol>
                  <p className="mt-3">Your account is deleted straight away and you are signed out.</p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">By email</h2>
                  <p>
                    Cannot open the app? Email <a href={`mailto:${COMPANY.email}`} className="text-gold-400 hover:text-gold-300 underline underline-offset-2 decoration-gold-400/40">{COMPANY.email}</a> from the address on your account, with the subject &quot;Delete my account&quot;. We confirm the request with you and delete the account within 30 days.
                  </p>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">What is deleted</h2>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Your login, name, email address and phone number on the account.</li>
                    <li>Your saved details and notifications.</li>
                    <li>The push notification address of your phone.</li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-white font-display text-xl mb-3">What we keep</h2>
                  <p>
                    Booking records are not deleted. They are our record of journeys driven and payments taken, and Spanish commercial law requires us to keep them for 7 years. After you delete your account they remain as bookings with no account attached. See the <a href="/privacy" className="text-gold-400 hover:text-gold-300 underline">Privacy Policy</a> for details.
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
