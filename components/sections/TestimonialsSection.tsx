"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Star, BadgeCheck } from "lucide-react";
import { REVIEWS, GOOGLE_PROFILE, initials } from "@/data/reviews";

/**
 * Real Google reviews.
 *
 * This replaced six invented testimonials — "James H., London", "Sophie B.,
 * Paris" and four more who were never customers — alongside a claim of 312
 * reviews when the profile holds 15.
 *
 * Every card is read-only. The owner asked for the reviews to stay on the site
 * rather than send the reader out to Google, so nothing here is a link.
 *
 * The tick means the review is on the public Google profile and has been
 * checked against it. It is shown per review rather than blanket, so an entry
 * that has not been verified cannot borrow the credibility of one that has.
 */
export default function TestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("article")?.clientWidth ?? 380;
    el.scrollBy({ left: dir === "right" ? cardWidth * 2 : -cardWidth * 2, behavior: "smooth" });
  };

  if (REVIEWS.length === 0) return null;

  return (
    <section className="py-20 bg-[#070707] border-t border-white/[0.06]">
      <div className="container mx-auto px-4">

        {/* Heading */}
        <div className="text-center mb-10">
          <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-3">
            Customer Reviews
          </span>
          <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
            What our <span className="text-gold-gradient">clients say</span>
          </h2>

          {/* The rating as it stands on the Google profile. The owner asked for
              no review total on the page — the reviews themselves are the
              evidence. GOOGLE_PROFILE.count still governs how many may be
              listed, and still feeds the structured data, where a count is
              required to be accurate rather than hidden. */}
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-gold-500/20 bg-gold-500/[0.04]">
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <span className="font-display text-[#4285F4] text-base font-bold leading-none">G</span>
            </span>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-xl text-white leading-none">
                  {GOOGLE_PROFILE.rating.toFixed(1)}
                </span>
                <span className="flex" role="img" aria-label={`Rated ${GOOGLE_PROFILE.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className="fill-gold-500 text-gold-500" />
                  ))}
                </span>
              </div>
              <p className="text-dark-400 text-xs mt-0.5">Rated on Google</p>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide"
          >
            {REVIEWS.map((r) => (
              <article
                key={`${r.author}-${r.when}`}
                className="snap-center flex-shrink-0 w-[300px] sm:w-[380px] glass-card rounded-2xl p-6 flex flex-col"
              >
                <div className="flex items-center gap-1 mb-3" role="img" aria-label={`Rated ${r.rating} out of 5`}>
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-gold-500 text-gold-500" />
                  ))}
                </div>

                {r.text ? (
                  <p className="text-dark-200 text-sm leading-relaxed flex-1">{r.text}</p>
                ) : (
                  // A rating with no words. Said plainly rather than dressed up
                  // with a sentence the reviewer never wrote.
                  <p className="text-dark-400 text-sm italic flex-1">
                    Rated {r.rating} out of 5 — no comment left.
                  </p>
                )}

                <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                  <div className="w-9 h-9 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold-400 text-xs font-semibold">{initials(r.author)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white text-sm font-medium truncate">{r.author}</p>
                      {r.verified && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#4285F4]/10 border border-[#4285F4]/30 flex-shrink-0"
                          title="Checked against the public Google profile"
                        >
                          <BadgeCheck size={10} className="text-[#4285F4]" />
                          <span className="text-[#4285F4] text-[9px] font-semibold tracking-wide">
                            VERIFIED
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-dark-400 text-xs mt-0.5">Google · {r.when}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Arrows appear only when there is more than one screen of cards. */}
          {REVIEWS.length > 2 && (
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => scroll("left")}
                aria-label="Previous reviews"
                style={{ touchAction: "manipulation" }}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scroll("right")}
                aria-label="More reviews"
                style={{ touchAction: "manipulation" }}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-gold-400 hover:border-gold-500/30 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
