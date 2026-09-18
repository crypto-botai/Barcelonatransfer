"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { COMPANY } from "@/lib/company-facts";
import { Star, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { GOOGLE_PROFILE } from "@/data/reviews";

/** The Google profile the guest book quotes; reviewing is one tap from there. */
const GOOGLE_REVIEW_URL = `https://www.google.com/maps?cid=${GOOGLE_PROFILE.cid}`;

function ReviewInner() {
  const params    = useSearchParams();
  const bookingId = params.get("booking");
  const initRating = parseInt(params.get("rating") ?? "0");

  const [rating,    setRating]    = useState(initRating);
  const [companyRating, setCompanyRating] = useState(0);
  const [hoverCo, setHoverCo] = useState(0);
  const [hover,     setHover]     = useState(0);
  const [review,    setReview]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  const submit = async () => {
    if (!bookingId || rating === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/bookings/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, review, companyRating: companyRating || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!bookingId) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
        <div className="glass-card rounded-2xl p-10 text-center max-w-sm">
          <p className="text-dark-400">Invalid review link. Please use the link from your email.</p>
          <Link href="/" className="btn-gold mt-6 px-6 py-3 rounded-xl text-sm inline-block">Back to Home</Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-10 text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} className="text-green-400" />
          </div>
          <h2 className="font-display text-2xl text-white mb-3">Thank You!</h2>
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={24} className={i < rating ? "text-gold-400 fill-gold-400" : "text-dark-500"} />
            ))}
          </div>
          <p className="text-dark-400 text-sm mb-6">
            Your {rating}-star review has been submitted. We truly appreciate your feedback and look forward to serving you again.
          </p>
          {rating >= 4 && (
            <div className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/[0.06] p-4 text-left">
              <p className="text-white text-sm font-medium">Would you say it on Google?</p>
              <p className="text-dark-400 text-xs mt-1">A public review takes a minute and is the single thing that helps a small chauffeur company most.</p>
              <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" className="btn-gold mt-3 inline-block px-5 py-2.5 rounded-xl text-sm font-semibold">Write a Google review</a>
            </div>
          )}
          <Link href="/" className="btn-outline-gold px-8 py-3 rounded-xl text-sm font-semibold inline-block">
            Book Another Transfer
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 max-w-md w-full"
      >
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl text-white mb-2">How Was Your Journey?</h1>
          <p className="text-dark-400 text-sm">Your feedback helps us maintain our luxury standard of service.</p>
        </div>

        {/* Star rating: the chauffeur */}
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gold-500/80 mb-3">Your chauffeur</p>
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => {
            const val = i + 1;
            return (
              <button
                key={val}
                onMouseEnter={() => setHover(val)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(val)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={40}
                  className={`transition-colors ${
                    val <= (hover || rating)
                      ? "text-gold-400 fill-gold-400"
                      : "text-dark-500"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {rating > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-gold-400 mb-6 -mt-4"
          >
            {["", "Poor", "Fair", "Good", "Very Good", "Excellent!"][rating]}
          </motion.p>
        )}

        {/* Star rating: the company */}
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-gold-500/80 mb-3">Elite BCN overall</p>
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => {
            const val = i + 1;
            return (
              <button key={val} type="button" onMouseEnter={() => setHoverCo(val)} onMouseLeave={() => setHoverCo(0)} onClick={() => setCompanyRating(val)} aria-label={`Rate Elite BCN ${val} of 5`} className="transition-transform hover:scale-110 active:scale-95">
                <Star size={30} className={`transition-colors ${val <= (hoverCo || companyRating) ? "text-gold-400 fill-gold-400" : "text-dark-500"}`} />
              </button>
            );
          })}
        </div>

        {/* Review text */}
        <div className="mb-6">
          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <MessageSquare size={11} /> Comments <span className="text-dark-500 normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Tell us about your experience with the driver, vehicle, and service…"
            className="input-luxury w-full px-4 py-3 rounded-xl text-sm resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={rating === 0 || submitting}
          className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Submit Review
        </button>

        <p className="text-center text-xs text-dark-500 mt-4">
          Elite BCN Transfers · {COMPANY.email}
        </p>
      </motion.div>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <ReviewInner />
      </Suspense>
    </>
  );
}
