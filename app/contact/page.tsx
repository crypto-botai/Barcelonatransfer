import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import ContactFormClient from "./ContactFormClient";
import { COMPANY } from "@/lib/company-facts";

export const metadata: Metadata = {
  title: { absolute: "Contact Élite BCN | 24/7 Transfer Support Barcelona" },
  description:
    "Contact Élite BCN Transfers for bookings, support, or enquiries. Available 24/7 by phone, WhatsApp, or email. Barcelona's premier private chauffeur service.",
  alternates: { canonical: "https://www.elitebcn.info/contact" },
  keywords: ["contact elite bcn", "barcelona transfer contact", "chauffeur barcelona phone", "barcelona transfer whatsapp"],
  openGraph: {
    title: "Contact Élite BCN — 24/7 Support",
    description:
      "Reach our team 24/7 by phone, WhatsApp, or email. Barcelona luxury private transfer specialists.",
    url: "https://www.elitebcn.info/contact",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Contact Élite BCN Transfers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Élite BCN — 24/7 Support",
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
  name: "Contact Élite BCN Transfers",
  url: "https://www.elitebcn.info/contact",
  description: "Contact Élite BCN Transfers 24/7 for bookings, enquiries and corporate accounts.",
  mainEntity: {
    "@type": "Organization",
    name: "Élite BCN Transfers",
    telephone: "+34635383712",
    email: "vtcbcn2025@gmail.com",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+34635383712",
      contactType: "customer service",
      availableLanguage: ["English", "Spanish", "Catalan"],
      hoursAvailable: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" },
    },
  },
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
              Get in <span className="text-gold-gradient">Touch</span>
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
      </main>
      <Footer />
    </>
  );
}
