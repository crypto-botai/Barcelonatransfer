"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

const FAQS = [
  {
    q: "How far in advance should I book?",
    a: "We recommend booking at least 24 hours in advance for guaranteed availability. For peak dates, holidays, or large group transfers, booking 48–72 hours ahead is ideal. Last-minute bookings are often possible — contact us via WhatsApp for urgent requests.",
  },
  {
    q: "Do you offer flight monitoring for airport transfers?",
    a: "Yes. For all airport pickups, we track your flight in real time. If your flight is delayed, your chauffeur adjusts their arrival accordingly at no extra charge. You get 60 minutes of complimentary waiting time after landing.",
  },
  {
    q: "Are your prices all-inclusive? Any hidden fees?",
    a: "All prices are completely fixed and all-inclusive. They cover the professional chauffeur, premium vehicle, tolls, congestion charges, and airport/cruise terminal fees. There is zero surge pricing, ever. What you see is what you pay.",
  },
  {
    q: "What vehicles do you offer?",
    a: "We offer 10 vehicle classes from Economy Sedans to Minibuses. Our fleet includes Mercedes E-Class, S-Class, V-Class VIP, BMW 5 and 7 Series, Tesla Model S, Range Rover Autobiography, Cadillac Escalade, and Mercedes Sprinter. All vehicles are professionally maintained and less than 3 years old.",
  },
  {
    q: "Can I cancel or modify my booking?",
    a: "Yes. Free cancellation is available up to 24 hours before your scheduled pickup. Modifications can be made at any time subject to availability. Contact us via email or WhatsApp to make changes.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards, Apple Pay, Google Pay, and bank transfers for corporate accounts. Payments are processed securely through Stripe. You'll receive an invoice automatically after payment.",
  },
  {
    q: "Do you serve destinations outside Barcelona?",
    a: "Absolutely. We transfer to all major destinations including Girona, Tarragona, Andorra, the Costa Brava resorts (Lloret, Tossa, Cadaqués), Costa Dorada (Sitges, Salou, PortAventura), and even Madrid and southern France on request.",
  },
  {
    q: "Can I request a child seat?",
    a: "Yes — child seats are available for infants and young children at no extra charge. Please mention this when booking so we can ensure the correct seat is installed. We offer forward and rearward-facing options.",
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-24 bg-[#070707]" id="faq">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
            >
              FAQ
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-display text-4xl sm:text-5xl text-white mb-6"
            >
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-dark-400 leading-relaxed mb-8"
            >
              Everything you need to know about our luxury transfer service. Can&apos;t find the answer you&apos;re looking for?
            </motion.p>
            <div className="flex flex-col gap-3">
              <Link
                href="/contact"
                className="btn-outline-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold w-fit"
              >
                Contact Support
              </Link>
              <a
                href="https://wa.me/34635383712"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-dark-400 hover:text-green-400 transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                WhatsApp — instant reply
              </a>
            </div>
          </div>

          {/* Right — Accordion */}
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl border transition-colors ${
                  open === i ? "border-gold-500/30 bg-gold-500/5" : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className={`text-sm font-medium transition-colors ${open === i ? "text-gold-400" : "text-white"}`}>
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-dark-400 flex-shrink-0 ml-4 transition-transform duration-300 ${open === i ? "rotate-180 text-gold-400" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm text-dark-300 leading-relaxed">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
