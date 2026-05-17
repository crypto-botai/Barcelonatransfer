"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "James Harrington",
    role: "CEO, Harrington Capital",
    location: "London, UK",
    rating: 5,
    text: "I use Élite BCN every time I fly into Barcelona for business. The level of professionalism is unmatched — impeccably dressed driver, spotless Mercedes S-Class, and they always track my flight. This is the standard every transfer service should aspire to.",
    avatar: "JH",
  },
  {
    name: "Sophie Beaumont",
    role: "Fashion Director",
    location: "Paris, France",
    rating: 5,
    text: "I booked a Mercedes V-Class for our entire fashion team arriving at El Prat. They were waiting with our name board, helped with all 12 suitcases, and had champagne ready in the vehicle. Absolutely five-star — we use them exclusively now.",
    avatar: "SB",
  },
  {
    name: "Marcus von Behr",
    role: "Private Equity Partner",
    location: "Frankfurt, Germany",
    rating: 5,
    text: "Excellent service from start to finish. The online booking is seamless, pricing is transparent, and the confirmation email was immediate. When a deal ran long and we needed the chauffeur to wait an extra two hours — no problem, no extra hidden charges.",
    avatar: "MB",
  },
  {
    name: "Isabella Rossetti",
    role: "Luxury Travel Consultant",
    location: "Milan, Italy",
    rating: 5,
    text: "I recommend Élite BCN to all my high-net-worth clients travelling to Barcelona. They consistently deliver the level of discretion and quality my clients demand. The electric Tesla Model S option is perfect for eco-conscious VIPs.",
    avatar: "IR",
  },
  {
    name: "David & Emma Clarke",
    role: "Newlyweds",
    location: "Manchester, UK",
    rating: 5,
    text: "Booked the Rolls-Royce-style V-Class for our wedding day transfers. The driver was incredible — patient, elegant, and made our special day even more memorable. Would recommend to anyone wanting the absolute best.",
    avatar: "DC",
  },
];

export default function TestimonialsSection() {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  const next = () => setCurrent((c) => (c + 1) % TESTIMONIALS.length);

  const t = TESTIMONIALS[current];

  return (
    <section className="py-24 bg-dark-950" id="testimonials">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4"
          >
            Client Reviews
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl text-white"
          >
            What Our <span className="text-gold-gradient">Clients Say</span>
          </motion.h2>
          <div className="gold-divider mt-6" />
        </div>

        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="testimonial-card glass-card rounded-2xl p-8 sm:p-12 relative"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={16} className="text-gold-500 fill-gold-500" />
                ))}
              </div>

              {/* Text */}
              <p className="text-dark-200 text-lg leading-relaxed mb-8 italic">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center">
                  <span className="font-display text-gold-400 font-semibold">{t.avatar}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{t.name}</p>
                  <p className="text-dark-400 text-sm">{t.role}</p>
                  <p className="text-dark-500 text-xs mt-0.5">{t.location}</p>
                </div>
                <div className="ml-auto">
                  <div className="text-xs text-dark-500 text-right">Verified Google Review</div>
                  <div className="flex gap-0.5 justify-end mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} className="text-[#fbbc04] fill-[#fbbc04]" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 mt-8">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === current ? "w-6 bg-gold-500" : "w-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Rating badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center gap-8 mt-12"
        >
          {[
            { platform: "Google", rating: "4.9", count: "312" },
            { platform: "Trustpilot", rating: "4.8", count: "189" },
            { platform: "TripAdvisor", rating: "5.0", count: "94" },
          ].map((r) => (
            <div key={r.platform} className="text-center">
              <div className="flex justify-center gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className="text-gold-500 fill-gold-500" />
                ))}
              </div>
              <p className="text-white text-lg font-display font-semibold">{r.rating}</p>
              <p className="text-dark-500 text-xs">{r.platform} · {r.count} reviews</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
