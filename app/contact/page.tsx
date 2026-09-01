import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import ContactFormClient from "./ContactFormClient";
import { COMPANY } from "@/lib/company-facts";
import { SHARED_OG } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Contact Elite BCN | 24/7 Transfer Support Barcelona" },
  description:
    "Contact Elite BCN Transfers for bookings, support or enquiries. Available 24/7 by phone, WhatsApp or email.",
  alternates: { canonical: "https://www.elitebcn.info/contact" },
  keywords: ["contact elite bcn", "barcelona transfer contact", "chauffeur barcelona phone", "barcelona transfer whatsapp"],
  openGraph: {
    ...SHARED_OG,
    title: "Contact Elite BCN — 24/7 Support",
    description:
      "Reach our team 24/7 by phone, WhatsApp, or email. Barcelona luxury private transfer specialists.",
    url: "https://www.elitebcn.info/contact",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Contact Elite BCN Transfers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Elite BCN — 24/7 Support",
    description: "Reach our team 24/7 by phone, WhatsApp, or email. Barcelona luxury private transfer specialists.",
    images: ["/opengraph-image"],
  },
};

const CONTACT_ITEMS = [
  { icon: Phone,         label: "Phone",    value: "+34 635 383 712",  href: "tel:+34635383712",               external: false },
  { icon: Mail,          label: "Email",    value: COMPANY.email,      href: `mailto:${COMPANY.email}`,        external: false },
  { icon: MessageCircle, label: "WhatsApp", value: "Chat with us now", href: "https://wa.me/34635383712",      external: true },
  { icon: MapPin,        label: "Location", value: "Barcelona, Spain", href: "https://maps.google.com/?q=Barcelona,Spain", external: true },
];

const CONTACT_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact Elite BCN Transfers",
  url: "https://www.elitebcn.info/contact",
  description: "Contact Elite BCN Transfers 24/7 for bookings, enquiries and corporate accounts.",
  // A reference, not a second copy of the company.
  //
  // This redeclared the Organization with its own telephone, email and
  // contactPoint, which made /contact the fourth place the business described
  // itself. It also claimed Catalan as an available language — a claim the
  // 25 Aug data-accuracy work removed from the layout and from llms.txt,
  // because the site does not publish in Catalan. The test that guards it only
  // read app/layout.tsx, so this copy survived and kept saying it.
  //
  // The LocalBusiness node in the root layout carries the phone, the opening
  // hours and knowsLanguage derived from SUPPORTED_LOCALES, and it ships on
  // this page like every other. Pointing at it is both correct and unfalsifiable.
  mainEntity: { "@id": "https://www.elitebcn.info/#business" },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",    item: "https://www.elitebcn.info" },
      { "@type": "ListItem", position: 2, name: "Contact", item: "https://www.elitebcn.info/contact" },
    ],
  },
};

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(CONTACT_SCHEMA) }} />
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Contact</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Contact Elite BCN — <span className="text-gold-gradient">Barcelona Transfers</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">
              Available 24/7 for bookings, inquiries, and corporate accounts.
            </p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
              {/* Contact info — static, no client state needed */}
              <div>
                <h2 className="font-display text-3xl text-white mb-8">We&apos;re Here to Help</h2>
                <div className="space-y-5">
                  {CONTACT_ITEMS.map((c) => (
                    <a key={c.label} href={c.href}
                      target={c.external ? "_blank" : undefined}
                      rel={c.external ? "noreferrer" : undefined}
                      className="flex items-center gap-4 p-4 rounded-xl glass-card gold-hover-border group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center">
                        <c.icon size={18} className="text-gold-500" />
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs tracking-wider uppercase">{c.label}</p>
                        <p className="text-white text-sm font-medium group-hover:text-gold-400 transition-colors">{c.value}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Interactive form — client component */}
              <ContactFormClient />
            </div>
          </div>
        </section>

        {/* Practical detail. The page was 43 words: two headings and a form. */}
        <section className="py-16 bg-[#050505] border-t border-white/[0.06]">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display text-3xl text-white mb-6">
              Getting a <span className="text-gold-gradient">fast answer</span>
            </h2>
            <div className="space-y-4 text-dark-300 leading-relaxed">
              <p>
                WhatsApp is the quickest way to reach us, and the right one if you are
                travelling today &mdash; a driver who is already on the road, a flight that has just
                been delayed, or a pickup you need to move by an hour. Email suits quotes,
                invoices and anything with an attachment. Both are watched around the clock,
                every day of the year.
              </p>
              <p>
                If your message is about a booking that already exists, quote the confirmation
                code from your email. If it is a new quote, the four things that let us answer
                in one reply rather than three are: where you are being collected, where you are
                going, the date and time, and how many passengers and suitcases are travelling.
                For airport pickups, send the flight number too &mdash; we track the flight and adjust
                the pickup to the actual landing time.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Changing or cancelling</h3>
              <p>
                Plans change and that is fine. Cancel more than 24 hours before pickup and you
                are refunded in full; inside 24 hours a 50% charge applies, and a no-show is
                charged in full. Refunds go back to the card you paid with, normally within five
                to seven working days. Moving a booking to a different time or date is free
                whenever we can accommodate it &mdash; ask rather than cancelling and rebooking.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Invoices and VAT</h3>
              <p>
                Quoted fares exclude VAT and tolls. If you need a proper invoice for expenses or
                for your company&apos;s accounts, ask and we will issue one with 10% Spanish VAT
                added and your company details on it. Tell us at the time of booking where
                possible, as it is simpler than reissuing afterwards.
              </p>
              <h3 className="font-display text-xl text-white pt-4">Where we drive</h3>
              <p>
                Barcelona and the whole of Catalonia &mdash; the airport, the cruise terminals, Sants
                station, the Costa Brava and Costa Dorada, Girona and Reus airports, PortAventura,
                Montserrat and the ski resorts. We also run longer routes across the border and
                into the Pyrenees, including Andorra and Lourdes. If the destination is not on the
                site, ask; if we cannot do it well we will say so rather than take the booking.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
