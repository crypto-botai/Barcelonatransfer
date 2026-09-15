"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import StarRating, { StarSprite } from "@/components/reviews/StarRating";
import { REVIEWS, GOOGLE_PROFILE, initials, type Review } from "@/data/reviews";

/**
 * The guest book.
 *
 * Real Google reviews, one at a time, set large as a pull-quote with the
 * reviewer's initials in a gold monogram ring and the verified seal beside
 * their name. A thin gold line fills while each quote holds, then the next
 * rises in. The reader can move through them with the arrows, the keyboard,
 * or the guest list beside the quote, and the remaining reviews drift across
 * beneath as a strip of notes.
 *
 * Every word is the reviewer's own, in the language they wrote it, read from
 * data/reviews.ts or the live list the admin panel supplies. Nothing here is
 * invented, edited or translated. This replaced six invented testimonials in
 * 2025 and the card grid that followed them.
 *
 * Two owner decisions carried forward from the previous version: no review
 * total appears on the page, the reviews themselves being the evidence, and
 * the only link is the one on the rating itself, to the Google profile the
 * reviews come from. Each review is otherwise read-only.
 *
 * The tick means the review is on the public profile and has been checked
 * against it. It is shown per review, so an entry that has not been verified
 * cannot borrow the credibility of one that has.
 */

const HOLD_SECONDS = 7;
const EASE = [0.16, 1, 0.3, 1] as const;

const quoteVariants: Variants = {
  enter:  { opacity: 0, y: 18 },
  center: { opacity: 1, y: 0, transition: { duration: 1.0, ease: EASE } },
  exit:   { opacity: 0, y: -14, transition: { duration: 0.4, ease: [0.7, 0, 0.84, 0] } },
};

function Monogram({ name, size = "lg" }: { name: string; size?: "lg" | "sm" }) {
  const dim = size === "lg" ? "w-[52px] h-[52px] text-[17px]" : "w-[34px] h-[34px] text-[12px]";
  return (
    <span className={`relative grid place-items-center rounded-full border border-[#c9a84c]/30 font-display text-gold-300 flex-shrink-0 ${dim}`} aria-hidden="true">
      <span className="absolute inset-1 rounded-full border border-[#c9a84c]/15" />
      {initials(name)}
    </span>
  );
}

export default function TestimonialsSection({
  reviews = REVIEWS,
  profile = GOOGLE_PROFILE,
}: {
  /** Live reviews from the admin panel. Falls back to data/reviews.ts. */
  reviews?: readonly Review[];
  profile?: { name: string; cid: string; rating: number; count: number };
} = {}) {
  const reduce = useReducedMotion();
  // Only reviews with words can be quoted; a stars-only review still appears in the guest list.
  const quoted = reviews.filter((r) => r.text && r.text.trim().length > 0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = quoted[index];

  const go = useCallback((next: number) => {
    const n = quoted.length;
    if (n === 0) return;
    setIndex(((next % n) + n) % n);
  }, [quoted.length]);

  // The hold: advance after HOLD_SECONDS unless the reader is on the quote.
  useEffect(() => {
    if (reduce || paused || quoted.length < 2) return;
    const id = setTimeout(() => go(index + 1), HOLD_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [index, paused, reduce, quoted.length, go]);

  // Arrow keys move through the book while it is on screen.
  const bookRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = bookRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft")  go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  if (reviews.length === 0) return null;

  return (
    <section className="py-20 sm:py-24 bg-[#070707] border-t border-white/[0.06]" aria-label="Guest book">
      <StarSprite />
      <div className="container mx-auto px-4">
        {/* Head */}
        <div className="flex flex-wrap items-end justify-between gap-8 mb-10">
          <div>
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Guest book</span>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.02] max-w-[14ch]">
              In their <em className="not-italic text-gold-gradient">own words.</em>
            </h2>
          </div>

          {/* The rating as it stands on the profile, linked to it. No total:
              the owner asked for the reviews to be the evidence. */}
          <a
            href={`https://www.google.com/maps?cid=${profile.cid}`}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4"
            aria-label={`${profile.rating.toFixed(1)} on Google, opens the profile`}
          >
            <span className="font-display text-5xl sm:text-[56px] leading-none text-gold-300">{profile.rating.toFixed(1)}</span>
            <span className="flex flex-col gap-1.5">
              <StarRating count={5} size={13} className="text-gold-500" />
              <span className="text-[10.5px] tracking-[0.22em] uppercase text-dark-500 font-medium group-hover:text-gold-400 transition-colors">On Google · every review verified</span>
            </span>
          </a>
        </div>

        <div ref={bookRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10 lg:gap-16 items-start">
          {/* The quote */}
          <div>
            <div
              className="relative pt-11"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocusCapture={() => setPaused(true)}
              onBlurCapture={() => setPaused(false)}
              aria-live="polite"
            >
              <span className="absolute -left-2.5 -top-7 font-display text-[190px] leading-none select-none pointer-events-none" style={{ color: "transparent", WebkitTextStroke: "1px rgba(201,168,76,0.4)" }} aria-hidden="true">“</span>
              <div className="grid">
                <AnimatePresence initial={false} mode="popLayout">
                  {current && (
                    <motion.figure key={index} variants={quoteVariants} initial="enter" animate="center" exit="exit" className="[grid-area:1/1] m-0 flex flex-col gap-7">
                      <blockquote className="m-0 font-display text-[clamp(22px,2.4vw,34px)] leading-[1.3] text-white max-w-[26ch] [text-wrap:pretty]">
                        {current.text}
                      </blockquote>
                      <figcaption className="flex items-center gap-4">
                        <Monogram name={current.author} />
                        <div>
                          <div className="text-[15px] text-white">{current.author}</div>
                          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                            <StarRating count={current.rating} size={12} className="text-gold-500" />
                            <span className="text-[10.5px] tracking-[0.22em] uppercase text-dark-500 font-medium">{current.when}</span>
                            {current.verified && (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.18em] uppercase text-gold-500 font-medium">
                                <BadgeCheck size={12} strokeWidth={1.6} aria-hidden />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </figcaption>
                    </motion.figure>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* The hold line, filling over the quote's stay. */}
            <div className="relative h-px bg-white/[0.08] mt-8" aria-hidden="true">
              {!reduce && quoted.length > 1 && (
                <motion.i
                  key={`${index}-${paused}`}
                  className="absolute left-0 top-0 h-px w-full bg-gold-500 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: paused ? 0 : 1 }}
                  transition={{ duration: paused ? 0.2 : HOLD_SECONDS, ease: "linear" }}
                />
              )}
            </div>

            <div className="flex items-center gap-3.5 mt-5">
              <button type="button" onClick={() => go(index - 1)} aria-label="Previous review" className="w-11 h-11 grid place-items-center border border-white/[0.08] text-dark-300 hover:text-gold-300 hover:border-[#c9a84c]/30 transition-colors">
                <ChevronLeft size={18} strokeWidth={1.3} />
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label="Next review" className="w-11 h-11 grid place-items-center border border-white/[0.08] text-dark-300 hover:text-gold-300 hover:border-[#c9a84c]/30 transition-colors">
                <ChevronRight size={18} strokeWidth={1.3} />
              </button>
              <span className="font-mono text-[11px] tracking-[0.3em] text-dark-500 ml-1.5 tabular-nums">
                {String(index + 1).padStart(2, "0")} / {String(quoted.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* The guest list: everyone, including a reviewer who left stars and no words. */}
          <div className="hidden lg:flex flex-col border-t border-[#c9a84c]/30" role="tablist" aria-label="Reviewers">
            {reviews.map((r) => {
              const qi = quoted.indexOf(r);
              const selected = qi === index;
              return (
                <button
                  key={`${r.author}-${r.when}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={qi < 0}
                  onClick={() => go(qi)}
                  className="relative grid grid-cols-[34px_minmax(0,1fr)_auto] gap-3.5 items-center py-3 border-b border-white/[0.08] text-left disabled:cursor-default"
                >
                  <span className={`absolute -left-4 top-0 bottom-0 w-px bg-gold-500 origin-top transition-transform duration-500 ${selected ? "scale-y-100" : "scale-y-0"}`} aria-hidden="true" />
                  <span className={`grid place-items-center w-[34px] h-[34px] rounded-full border font-display text-[12px] transition-colors ${selected ? "border-[#c9a84c]/30 text-gold-300" : "border-white/[0.08] text-dark-500"}`} aria-hidden="true">{initials(r.author)}</span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] truncate ${selected ? "text-white" : "text-dark-300"}`}>{r.author}</span>
                    <span className="block text-[11px] text-dark-500">{r.when}</span>
                  </span>
                  <StarRating count={r.rating} size={11} className="text-gold-500" />
                </button>
              );
            })}
          </div>
        </div>

        {/* The strip of notes: the quoted reviews drifting past, paused under the pointer. */}
        {quoted.length > 1 && (
          <div
            className="relative mt-16 overflow-hidden"
            style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}
            aria-hidden="true"
          >
            <div className="flex gap-3.5 w-max animate-[guestbook-drift_90s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
              {[...quoted, ...quoted].map((r, i) => (
                <div key={i} className="w-[300px] flex-shrink-0 border border-white/[0.08] bg-[#0c0b09] px-5 py-[18px] flex flex-col gap-3">
                  <p className="m-0 text-[13px] leading-relaxed text-dark-300 line-clamp-3">{r.text}</p>
                  <div className="flex items-center gap-3">
                    <Monogram name={r.author} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-white truncate">{r.author}</div>
                      <div className="text-[11px] text-dark-500">{r.when}</div>
                    </div>
                    {r.verified && <BadgeCheck size={13} strokeWidth={1.6} className="text-gold-500 flex-shrink-0" aria-label="Verified" />}
                    <StarRating count={r.rating} size={11} className="text-gold-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-dark-500 text-[13px] leading-relaxed max-w-[60ch] mt-14 pt-6 border-t border-[#c9a84c]/30">
          Every review here was written by a passenger on our Google profile and is shown as they wrote it, in their own language. We do not edit them and we do not pay for them.
        </p>
      </div>
    </section>
  );
}
