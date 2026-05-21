"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Timer, MessageCircle, Tag } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY   = "elite_exit_popup_shown";
const COOLDOWN_DAYS = 7;
const DELAY_MS      = 45_000; // 45 seconds

// Pages where we should NEVER show the popup
const EXCLUDED_PATHS = ["/admin", "/driver", "/auth", "/booking/success", "/booking/failed"];

function isOnCooldown(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return daysSince < COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

function markShown() {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
}

export default function ExitIntentPopup() {
  const pathname     = usePathname();
  const [visible,    setVisible]    = useState(false);
  const [email,      setEmail]      = useState("");
  const [submitted,  setSubmitted]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [couponCode, setCouponCode] = useState("");

  // Don't mount on excluded paths
  const excluded = EXCLUDED_PATHS.some((p) => pathname.startsWith(p));

  const show = useCallback(() => {
    if (typeof window === "undefined") return;
    if (excluded) return;
    if (isOnCooldown()) return;
    markShown();
    setVisible(true);
  }, [excluded]);

  useEffect(() => {
    if (excluded) return;

    // Exit intent: mouse leaves viewport from the top
    const handleMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && e.relatedTarget === null) show();
    };
    document.addEventListener("mouseout", handleMouseOut);

    // Fallback: show after 45 seconds of being on a non-excluded page
    const timer = setTimeout(show, DELAY_MS);

    return () => {
      document.removeEventListener("mouseout", handleMouseOut);
      clearTimeout(timer);
    };
  }, [show, excluded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "exit-popup" }),
      });
      const sessionId = typeof window !== "undefined" ? localStorage.getItem("elite_session_id") : null;
      if (sessionId) {
        await fetch("/api/booking-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, email, formData: {}, step: 1 }),
        });
      }
      setCouponCode("ELITE-WELCOME");
      setSubmitted(true);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  if (!visible || excluded) return null;

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            onClick={() => setVisible(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md bg-[#0a0a0a] border border-gold-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/80">
              <div className="h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
              <div className="p-7">
                <button
                  onClick={() => setVisible(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                >
                  <X size={16} />
                </button>

                {!submitted ? (
                  <>
                    <div className="flex items-center justify-center mb-5">
                      <div className="w-16 h-16 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
                        <Tag size={28} className="text-gold-400" />
                      </div>
                    </div>
                    <h2 className="font-display text-2xl text-white text-center mb-2">
                      Wait! Don&apos;t Leave Yet
                    </h2>
                    <p className="text-dark-400 text-center text-sm mb-1 leading-relaxed">
                      Complete your Barcelona airport transfer booking
                    </p>
                    <p className="text-gold-400 font-semibold text-center text-lg mb-5">
                      and enjoy <span className="text-2xl">5% OFF</span>
                    </p>
                    <div className="bg-gold-500/8 border border-gold-500/20 rounded-xl p-4 mb-5 flex items-center gap-3">
                      <Timer size={16} className="text-gold-400 flex-shrink-0" />
                      <p className="text-sm text-dark-300">Enter your email for an exclusive coupon valid 48 hours</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="input-luxury w-full px-4 py-3 rounded-xl text-sm"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn-gold w-full py-3.5 rounded-xl font-semibold text-sm"
                      >
                        {loading ? "Sending…" : "Get My 5% OFF Coupon →"}
                      </button>
                    </form>
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <Link
                        href="/book"
                        onClick={() => setVisible(false)}
                        className="text-sm text-gold-400 hover:text-gold-300 transition-colors"
                      >
                        Book Now Without Discount
                      </Link>
                      <button
                        onClick={() => setVisible(false)}
                        className="text-xs text-dark-500 hover:text-dark-400 transition-colors"
                      >
                        No thanks
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
                      <span className="text-3xl">🎉</span>
                    </div>
                    <h2 className="font-display text-2xl text-white mb-2">Coupon Sent!</h2>
                    <p className="text-dark-400 text-sm mb-6">Check your email. Your exclusive coupon is on the way.</p>
                    <div className="bg-black/40 border border-gold-500/20 rounded-xl p-4 mb-6">
                      <p className="text-xs text-dark-400 tracking-widest uppercase mb-2">Your Coupon</p>
                      <p className="font-display text-xl text-gold-400 tracking-widest">{couponCode}</p>
                      <p className="text-xs text-dark-500 mt-1">Check your email for your personal 5% OFF code</p>
                    </div>
                    <Link
                      href="/book"
                      onClick={() => setVisible(false)}
                      className="btn-gold w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      Complete My Booking →
                    </Link>
                    <a
                      href="https://wa.me/34635383712"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-dark-400 hover:text-gold-400 transition-colors mt-3"
                    >
                      <MessageCircle size={14} />
                      Or book via WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
