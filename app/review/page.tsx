"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Star, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";

function ReviewInner() {
  const params    = useSearchParams();
  const bookingId = params.get("booking");
  const initRating = parseInt(params.get("rating") ?? "0");

  const [rating,    setRating]    = useState(initRating);
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
        body: JSON.stringify({ bookingId, rating, review }),
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
              <Star key={i} size={24} className={i < rating ? "text-gold-400 fill-gold-400" : "text-dark-600"} />
            ))}
          </div>
          <p className="text-dark-400 text-sm mb-6">
            Your {rating}-star review has been submitted. We truly appreciate your feedback and look forward to serving you again.
          </p>
          <Link href="/" className="btn-gold px-8 py-3 rounded-xl text-sm font-semibold inline-block">
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

        {/* Star rating */}
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
                      : "text-dark-600"
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

        {/* Review text */}
        <div className="mb-6">
          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <MessageSquare size={11} /> Comments <span className="text-dark-600 normal-case tracking-normal">(optional)</span>
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
          Élite BCN Transfers · vtcbcn2025@gmail.com
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
