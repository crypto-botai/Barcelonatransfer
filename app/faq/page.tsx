"use client";

import { useState } from "react";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import { ChevronDown, MessageCircle } from "lucide-react";
import Link from "next/link";

const FAQ_GROUPS = [
  {
    group: "Booking & Reservations",
    items: [
      {
        q: "How do I book a transfer?",
        a: "You can book instantly online via our booking page — select your service type, enter pick-up and drop-off locations, choose your vehicle, and confirm. You'll receive an email confirmation immediately. You can also book via WhatsApp or phone.",
      },
      {
        q: "How far in advance should I book?",
        a: "We recommend booking at least 24 hours in advance to guarantee vehicle availability. For peak periods, weekends, or special events in Barcelona, booking 48–72 hours ahead is advisable. Last-minute bookings may be accommodated — contact us directly.",
      },
      {
        q: "Can I book for someone else?",
        a: "Absolutely. When booking you can enter the passenger's name, phone, and email separately. The driver will be briefed with the passenger's details and will greet them by name.",
      },
      {
        q: "Is there a cancellation fee?",
        a: "Cancellations made more than 24 hours before the scheduled pickup are fully refunded. Cancellations within 24 hours may incur a 50% charge. No-shows are charged in full. Please contact us as early as possible if your plans change.",
      },
      {
        q: "Can I modify my booking after confirmation?",
        a: "Yes — contact us by WhatsApp or email as soon as possible with the changes. We'll do our best to accommodate modifications to date, time, or destination. Changes are subject to availability.",
      },
    ],
  },
  {
    group: "Airport Transfers",
    items: [
      {
        q: "Do you track my flight for delays?",
        a: "Yes. We monitor your flight in real time using your flight number. If your flight is delayed, your driver will adjust their arrival time automatically — you will never be charged for flight delays.",
      },
      {
        q: "Where will the driver meet me at the airport?",
        a: "Your driver will be waiting in the arrivals hall at El Prat Airport (Terminal 1 or Terminal 2) holding a personalised name board. For Meet & Greet bookings, the driver will assist you from the baggage reclaim area.",
      },
      {
        q: "How much free waiting time do I get at the airport?",
        a: "We offer 60 minutes of complimentary waiting time for all airport pickups, counted from the actual flight landing time. Additional waiting time can be added as an extra at €25 per 30 minutes.",
      },
      {
        q: "Do you cover Girona Airport?",
        a: "Yes. We provide transfers to and from Girona–Costa Brava Airport (GRO). The fixed price from Barcelona city is €140 for an Economy sedan. Booking in advance is recommended.",
      },
    ],
  },
  {
    group: "Vehicles & Fleet",
    items: [
      {
        q: "What vehicles do you offer?",
        a: "Our fleet includes Standard Sedans (Toyota Corolla/Camry/Prius), Luxury Sedans (Lexus ES/Mercedes E-Class), Executive Minivans (Mercedes Vito/Ford Tourneo — up to 7 pax), Luxury Minivans (Mercedes V-Class — up to 7 pax), Group Minibuses (up to 16 pax), and Electric Vehicles (Tesla Model 3/Y).",
      },
      {
        q: "Are the vehicles clean and well-maintained?",
        a: "All vehicles are professionally cleaned and sanitised before every trip. Our fleet is maintained to the highest standards and all drivers carry fresh water, phone chargers, and sanitiser as standard.",
      },
      {
        q: "Can I request a specific vehicle model?",
        a: "We'll do our best to accommodate specific model requests. Please add a note in the Special Requests field when booking, or contact us directly to confirm availability.",
      },
      {
        q: "Do your vehicles have WiFi?",
        a: "Yes. All vehicles in our fleet are equipped with complimentary 4G WiFi. Luxury and VIP vehicles additionally feature premium sound systems and USB-C charging points.",
      },
    ],
  },
  {
    group: "Pricing & Payment",
    items: [
      {
        q: "Are your prices fixed or do they use surge pricing?",
        a: "All our prices are fixed and all-inclusive. We never apply surge pricing, peak-hour multipliers, or hidden fees. The price you see when you book is the price you pay — always.",
      },
      {
        q: "What is included in the price?",
        a: "All prices include the professional chauffeur, vehicle, fuel, tolls, parking, and standard waiting time. Airport transfers include flight tracking and 60 minutes free waiting. Night and early morning journeys may incur a 20% surcharge.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, Amex) through our secure online payment system. You can also pay via bank transfer or cash on request. Online payments are processed securely.",
      },
      {
        q: "Is there a night surcharge?",
        a: "A 20% night surcharge applies to journeys starting between 22:00 and 06:00. This is automatically calculated and displayed transparently during the booking process.",
      },
    ],
  },
  {
    group: "Extras & Add-ons",
    items: [
      {
        q: "Can I add child seats to my booking?",
        a: "Yes. We offer Baby Seats (0–13 kg), Child Seats (9–18 kg), and Booster Seats (15–36 kg) at €5 each. Simply add them during the booking process. Please specify your child's weight so we can provide the correct seat.",
      },
      {
        q: "Can I bring my pet?",
        a: "Pets are welcome with prior notice. Add the Pet Transport extra (€20) when booking. Please ensure your pet is in a carrier or on a lead. Our drivers are pet-friendly and the vehicle will be cleaned appropriately.",
      },
      {
        q: "What is the Meet & Greet service?",
        a: "For €5, your driver will meet you inside the arrivals hall at the airport, assist with your luggage from baggage reclaim, and escort you to the vehicle. This is especially recommended for first-time visitors or those with heavy luggage.",
      },
      {
        q: "Can the driver make multiple stops?",
        a: "Yes — add the Multiple Stops extra (€25 per stop) to your booking. This is ideal for hotel-to-meeting-to-restaurant itineraries or multi-destination tours.",
      },
    ],
  },
  {
    group: "Drivers & Safety",
    items: [
      {
        q: "Are your drivers licensed and insured?",
        a: "All our chauffeurs hold valid VTC (Vehículo de Turismo con Conductor) licences issued by the Barcelona Metropolitan Authority. All vehicles carry full professional passenger liability insurance.",
      },
      {
        q: "Do you provide English-speaking drivers?",
        a: "Yes. All our drivers speak English and Spanish. Many also speak French, Italian, German, or Arabic. If you have a specific language requirement, please note it when booking.",
      },
      {
        q: "Is it safe to book online?",
        a: "Absolutely. Our website uses industry-standard SSL encryption. Payment is processed by SumUp, a regulated European payment provider. We never store your card details.",
      },
      {
        q: "What if my driver doesn't arrive?",
        a: "This is extremely rare, but in the unlikely event of an issue, our operations team is available 24/7 by phone and WhatsApp. We will resolve the situation or arrange an alternative vehicle as quickly as possible.",
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 px-0 text-left group"
      >
        <span className="text-white text-sm font-medium pr-4 group-hover:text-gold-400 transition-colors">
          {q}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-gold-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="text-dark-400 text-sm leading-relaxed pb-5">
          {a}
        </p>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Help Centre</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Frequently Asked <span className="text-gold-gradient">Questions</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">
              Everything you need to know about booking your luxury transfer in Barcelona.
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="space-y-10">
              {FAQ_GROUPS.map((group) => (
                <div key={group.group}>
                  <h2 className="text-gold-500 text-xs tracking-[0.25em] uppercase font-medium mb-4">
                    {group.group}
                  </h2>
                  <div className="glass-card rounded-2xl px-6">
                    {group.items.map((item) => (
                      <FAQItem key={item.q} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Still have questions CTA */}
            <div className="mt-14 glass-card rounded-2xl p-8 text-center gold-hover-border">
              <h3 className="font-display text-2xl text-white mb-2">Still have questions?</h3>
              <p className="text-dark-400 text-sm mb-6">Our team is available 24 / 7 — reply within minutes.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="https://wa.me/34635383712"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-gold flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold"
                >
                  <MessageCircle size={16} />
                  Chat on WhatsApp
                </a>
                <Link
                  href="/contact"
                  className="btn-outline-gold flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold"
                >
                  Send a Message
                </Link>
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
