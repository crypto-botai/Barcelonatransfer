"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { SOCIAL_PROOF } from "@/lib/company-facts";

// 6 reviews — first name + initial + city only (no full names, no companies, no Verified badge)
const REVIEWS = [
  { name: "James H.",     location: "London",    avatar: "JH", rating: 5, text: "I use Elite BCN every time I fly into Barcelona for business. The professionalism is unmatched — impeccably dressed driver, spotless vehicle, real-time flight tracking every time." },
  { name: "Sophie B.",    location: "Paris",     avatar: "SB", rating: 5, text: "Booked a Mercedes Vito for our entire fashion team arriving at El Prat. They were waiting with name boards, helped with all 12 suitcases, and had refreshments ready. Absolutely five-star." },
  { name: "Marcus V.",    location: "Frankfurt", avatar: "MV", rating: 5, text: "Excellent service from start to finish. Pricing is fully transparent — what you see at booking is exactly what you pay. When my meeting ran late, the driver waited without complaint." },
  { name: "Isabella R.",  location: "Milan",     avatar: "IR", rating: 5, text: "I recommend Elite BCN to all my high-net-worth clients. They consistently deliver the discretion and quality that VIP travellers demand. The V-Class for larger groups is exceptional." },
  { name: "Michael C.",   location: "Singapore", avatar: "MC", rating: 5, text: "Booked three rides over four days for a conference. Every driver arrived early, kept the car at the perfect temperature, and had phone chargers ready. This is what premium means." },
  { name: "Laura J.",     location: "Oslo",      avatar: "LJ", rating: 5, text: "Organised transport for artist riders over two festival weekends. Zero complaints from any of the talent — the drivers were professional, quiet, and respected the no-photography requests completely." },
];

// Only Google until Trustpilot/TripAdvisor profiles are confirmed live.
const PLATFORMS = [
  { platform: "Google", rating: SOCIAL_PROOF.google.rating, count: SOCIAL_PROOF.google.count },
] as const;

export default function TestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("div")?.clientWidth ?? 380;
    el.scrollBy({ left: dir === "right" ? cardWidth * 3 : -cardWidth * 3, behavior: "smooth" });
  };

  return (
    <section className="py-24 bg-dark-950 overflow-hidden" id="testimonials">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">
            Client Reviews
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white">
            What Our <span className="text-gold-gradient">Clients Say</span>
          </h2>
          <div className="gold-divider mt-6" />
        </div>

        {/* Scroll controls */}
        <div className="flex justify-end gap-2 mb-4 pr-1">
          <button
            onClick={() => scroll("left")}
            className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              className="flex-shrink-0 w-[calc(33.333%-14px)] min-w-[280px] glass-card rounded-2xl p-6 flex flex-col"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} size={13} className="text-gold-500 fill-gold-500" />
                ))}
              </div>
              <p className="text-dark-200 text-sm leading-relaxed flex-1 italic mb-6">
                &ldquo;{r.text}&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <div className="w-10 h-10 rounded-full bg-gold-500/15 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-gold-400 text-xs font-semibold">{r.avatar}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-dark-400 text-xs">{r.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform ratings — numbers from SOCIAL_PROOF, not hardcoded */}
        <div className="flex justify-center gap-8 mt-10">
          {PLATFORMS.map((r) => (
            <div key={r.platform} className="text-center">
              <div className="flex justify-center gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} className="text-gold-500 fill-gold-500" />
                ))}
              </div>
              <p className="text-white text-lg font-display font-semibold">{r.rating}</p>
              <p className="text-dark-400 text-xs">{r.platform} · {r.count} reviews</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
