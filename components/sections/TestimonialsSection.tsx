"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

const REVIEWS = [
  { name: "James Harrington",    role: "CEO, Harrington Capital",      location: "London, UK",        avatar: "JH", rating: 5, text: "I use Élite BCN every time I fly into Barcelona for business. The level of professionalism is unmatched — impeccably dressed driver, spotless vehicle, and they always track my flight in real time." },
  { name: "Sophie Beaumont",     role: "Fashion Director",             location: "Paris, France",     avatar: "SB", rating: 5, text: "I booked a Mercedes Vito for our entire fashion team arriving at El Prat. They were waiting with name boards, helped with all 12 suitcases, and had refreshments ready. Absolutely five-star." },
  { name: "Marcus von Behr",     role: "Private Equity Partner",       location: "Frankfurt, Germany", avatar: "MV", rating: 5, text: "Excellent service from start to finish. Online booking is seamless, pricing is fully transparent, and when a meeting ran late, the driver waited without complaint. No hidden fees whatsoever." },
  { name: "Isabella Rossetti",   role: "Luxury Travel Consultant",     location: "Milan, Italy",      avatar: "IR", rating: 5, text: "I recommend Élite BCN to all my high-net-worth clients. They consistently deliver the discretion and quality that VIP travellers demand. The Tesla option is perfect for eco-conscious guests." },
  { name: "Michael Chen",        role: "Tech Executive",               location: "Singapore",         avatar: "MC", rating: 5, text: "Booked three rides over four days for a conference. Every single driver arrived early, kept the car at the perfect temperature, and had phone chargers ready. This is what premium means." },
  { name: "Anastasia Petrov",    role: "Brand Ambassador",             location: "Moscow, Russia",    avatar: "AP", rating: 5, text: "I've used chauffeur services in Paris, London, and Dubai — Élite BCN competes with all of them. The booking app is simple, the cars are immaculate, and the drivers genuinely care." },
  { name: "Robert Williams",     role: "Corporate Lawyer",             location: "New York, USA",     avatar: "RW", rating: 5, text: "Used for airport transfers during a week of client meetings in Barcelona. The driver wore a suit, offered still or sparkling water, and helped efficiently with luggage. Exactly what I needed." },
  { name: "Elena García",        role: "Wedding Planner",              location: "Madrid, Spain",     avatar: "EG", rating: 5, text: "Organised transport for a 40-person destination wedding. The fleet was coordinated perfectly — every guest arrived on time and commented on how professional the drivers were. Truly impressive." },
  { name: "Thomas Mitchell",     role: "Sports Agent",                 location: "London, UK",        avatar: "TM", rating: 5, text: "My clients are high-profile athletes who expect discretion. Élite BCN delivered exactly that — private, punctual, no photos, no fuss. We've added them to our permanent supplier list." },
  { name: "Marie-Claire Dupont", role: "Hotel General Manager",        location: "Geneva, Switzerland", avatar: "MD", rating: 5, text: "We partnered with Élite BCN to offer transfers to our hotel guests. Response times are excellent, the vehicles always arrive spotless, and guests consistently mention the service in reviews." },
  { name: "Carlos Rodríguez",    role: "Tech Entrepreneur",            location: "Mexico City, Mexico", avatar: "CR", rating: 5, text: "Came to Barcelona for Primavera Sound festival. The team arranged same-day transfers across three different venues. Reliable, well-priced, and the cars were clean. Will book again next year." },
  { name: "Kate Morrison",       role: "Features Editor",              location: "Dublin, Ireland",   avatar: "KM", rating: 5, text: "I've now used Élite BCN four trips in a row. I love that they send a confirmation with the driver's name and plate before every ride — it makes travelling alone feel so much safer." },
  { name: "Henrik Larsson",      role: "CFO, Nordic Holdings",         location: "Stockholm, Sweden", avatar: "HL", rating: 5, text: "Transferred from El Prat to our Sitges conference with seven colleagues in a V-Class. The space was perfect, the driver navigated traffic beautifully, and we arrived relaxed and on time." },
  { name: "Priya Sharma",        role: "Film Producer",                location: "Mumbai, India",     avatar: "PS", rating: 5, text: "We needed a driver on call for a four-day shoot in Barcelona. Incredibly flexible, always on time, and helped coordinate with our production coordinator. A pleasure to work with." },
  { name: "George Papadopoulos", role: "Shipping Executive",           location: "Athens, Greece",    avatar: "GP", rating: 5, text: "I travel to Barcelona regularly for business. Élite BCN is the only transfer service I've used where the driver actually helps you settle before leaving — not just opens the door and drives." },
  { name: "Laura Johansson",     role: "Concert Promoter",             location: "Oslo, Norway",      avatar: "LJ", rating: 5, text: "Organised transport for artist riders over two festival weekends. Zero complaints from any of the talent — the drivers were professional, quiet, and respected the no-photography requests completely." },
  { name: "Ahmed Al-Rashid",     role: "Investment Director",          location: "Dubai, UAE",        avatar: "AA", rating: 5, text: "The standard of service here rivals what I experience in Dubai. Perfectly chilled cabin, top-tier music selection, seamless pickup from T1. I booked a return trip before I even reached the hotel." },
  { name: "Valentina Ferrari",   role: "Creative Director",            location: "Rome, Italy",       avatar: "VF", rating: 5, text: "Booked a luxury minivan for a team of six travelling from the cruise port. Ample luggage space, cold water on board, and the driver was genuinely warm and knowledgeable about the city." },
  { name: "David & Emma Clarke", role: "Newlyweds",                    location: "Manchester, UK",    avatar: "DC", rating: 5, text: "Booked the V-Class luxury minivan for our wedding day. The driver was elegant and patient, making our special day even more memorable. We'd recommend Élite BCN to absolutely anyone." },
  { name: "William Thompson",    role: "Retired Diplomat",             location: "Sydney, Australia", avatar: "WT", rating: 5, text: "My wife and I used Élite BCN for a week of anniversary celebrations across Barcelona. Every ride felt like an event in itself — spotless cars, punctual drivers, and genuinely warm hospitality." },
];

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

        {/* Scrollable row — 3 cards visible */}
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
                  <p className="text-dark-400 text-xs truncate">{r.role}</p>
                  <p className="text-dark-500 text-xs">{r.location}</p>
                </div>
                <div className="ml-auto flex-shrink-0 text-right">
                  <p className="text-dark-600 text-[10px]">Verified</p>
                  <div className="flex gap-0.5 justify-end mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={9} className="text-[#fbbc04] fill-[#fbbc04]" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform ratings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center gap-8 mt-10"
        >
          {[
            { platform: "Google",      rating: "4.9", count: "312" },
            { platform: "Trustpilot",  rating: "4.8", count: "189" },
            { platform: "TripAdvisor", rating: "5.0", count: "94"  },
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
