"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Calendar, MapPin,
  MessageCircle, Mail, RefreshCw,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";

type BookingData = {
  status: "PAID" | "PENDING" | "FAILED";
  confirmationCode?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupDatetime?: string;
  vehicleClass?: string;
  totalAmount?: number;
  guestEmail?: string;
};

function SuccessInner() {
  const params    = useSearchParams();
  const bookingId = params.get("booking_id");
  const { status: sessionStatus } = useSession();
  const [data,     setData]     = useState<BookingData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [manualChecking, setManualChecking] = useState(false);

  const MAX_AUTO_ATTEMPTS = 20; // 20 × 3s = 60 seconds of polling

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }

    const verify = async () => {
      try {
        const res  = await fetch(`/api/payments/verify?booking_id=${bookingId}`);
        const json = await res.json();
        setData(json);

        if (json.status === "PENDING" && attempts < MAX_AUTO_ATTEMPTS) {
          setTimeout(() => setAttempts((a) => a + 1), 3000);
        } else {
          setLoading(false);
        }
      } catch {
        if (attempts < MAX_AUTO_ATTEMPTS) {
          setTimeout(() => setAttempts((a) => a + 1), 3000);
        } else {
          setLoading(false);
        }
      }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, attempts]);

  const manualCheck = async () => {
    if (!bookingId) return;
    setManualChecking(true);
    try {
      const res  = await fetch(`/api/payments/verify?booking_id=${bookingId}`);
      const json = await res.json();
      setData(json);
      if (json.status === "PAID") setLoading(false);
    } finally {
      setManualChecking(false);
    }
  };

  if (loading) {
    const dots = Math.min(3, Math.floor(attempts / 3));
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full border-2 border-gold-500/30 border-t-gold-500 animate-spin mx-auto mb-6" />
          <p className="text-white font-medium mb-2">Confirming your payment…</p>
          <p className="text-dark-500 text-sm">
            {attempts < MAX_AUTO_ATTEMPTS
              ? `Please wait${".".repeat(dots + 1)} (${attempts}/${MAX_AUTO_ATTEMPTS})`
              : "Still checking…"
            }
          </p>
          {attempts > 8 && (
            <p className="text-dark-600 text-xs mt-3">
              If you&apos;ve already paid, your booking is confirmed. This page will update automatically.
            </p>
          )}
        </motion.div>
      </main>
    );
  }

  const isPaid   = data?.status === "PAID";
  const isFailed = data?.status === "FAILED";
  const isPending = !isPaid && !isFailed;

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-8 max-w-md w-full text-center"
      >
        {isPaid ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 size={36} className="text-green-400" />
            </motion.div>
            <h1 className="font-display text-3xl text-white mb-2">Booking Confirmed!</h1>
            <p className="text-dark-400 mb-6">Your luxury transfer is confirmed. A confirmation email has been sent.</p>

            {data?.confirmationCode && (
              <div className="bg-black/30 rounded-xl p-5 mb-6 text-left space-y-3 text-sm">
                <div className="text-center mb-4">
                  <p className="text-dark-400 text-xs tracking-[0.2em] uppercase">Confirmation Code</p>
                  <p className="font-display text-2xl text-gold-400 mt-1 tracking-widest">
                    {data.confirmationCode}
                  </p>
                </div>
                {data.pickupAddress && (
                  <div className="flex items-start gap-3 border-t border-white/[0.06] pt-3">
                    <MapPin size={14} className="text-gold-500 mt-0.5 flex-shrink-0" />
                    <p className="text-dark-200">
                      {data.pickupAddress}
                      {data.dropoffAddress && ` → ${data.dropoffAddress}`}
                    </p>
                  </div>
                )}
                {data.pickupDatetime && (
                  <div className="flex items-center gap-3">
                    <Calendar size={14} className="text-gold-500 flex-shrink-0" />
                    <p className="text-dark-200">{new Date(data.pickupDatetime).toLocaleString("en-GB")}</p>
                  </div>
                )}
                <div className="border-t border-white/[0.06] pt-3 flex justify-between">
                  <span className="text-dark-400">Total Paid</span>
                  <span className="text-gold-400 font-semibold">€{data.totalAmount?.toFixed(2)}</span>
                </div>
              </div>
            )}

            {sessionStatus !== "authenticated" && data?.guestEmail && (
              <div className="bg-gold-500/8 border border-gold-500/20 rounded-xl p-4 mb-4 flex items-start gap-3 text-left">
                <Mail size={16} className="text-gold-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium mb-0.5">Account created for you</p>
                  <p className="text-xs text-dark-400">
                    Login details sent to <span className="text-gold-400">{data.guestEmail}</span>. Track your booking, see driver info &amp; manage future rides.
                  </p>
                  <Link href="/auth/login" className="text-xs text-gold-400 hover:text-gold-300 underline mt-1 inline-block">
                    Sign in now →
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link href="/" className="btn-gold w-full py-3.5 rounded-xl font-semibold">
                Back to Home
              </Link>
              <a
                href="https://wa.me/34635383712"
                target="_blank"
                rel="noreferrer"
                className="btn-outline-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                WhatsApp Support
              </a>
            </div>
          </>
        ) : isFailed ? (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <XCircle size={36} className="text-red-400" />
            </div>
            <h1 className="font-display text-3xl text-white mb-2">Payment Failed</h1>
            <p className="text-dark-400 mb-8">
              Your payment could not be processed. No charge was made. Please try again or contact us.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/book" className="btn-gold w-full py-3.5 rounded-xl font-semibold">
                Try Again
              </Link>
              <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer"
                className="btn-outline-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
                <MessageCircle size={16} /> Pay via WhatsApp
              </a>
            </div>
          </>
        ) : (
          /* PENDING — booking saved, payment not yet confirmed */
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mx-auto mb-6"
            >
              <Clock size={36} className="text-gold-400" />
            </motion.div>
            <h1 className="font-display text-3xl text-white mb-2">Booking Received!</h1>
            <p className="text-dark-400 mb-2">
              Your booking is saved and our team has been notified.
            </p>
            <p className="text-dark-400 text-sm mb-4">
              If you already paid via SumUp, your confirmation will appear shortly.
            </p>

            {data?.confirmationCode && (
              <div className="bg-black/30 rounded-xl p-5 mb-5 text-sm">
                <p className="text-dark-400 text-xs tracking-[0.2em] uppercase mb-2">Your Reference</p>
                <p className="font-display text-2xl text-gold-400 tracking-widest">{data.confirmationCode}</p>
                {data.totalAmount && (
                  <p className="text-dark-500 text-xs mt-2">Amount: €{data.totalAmount.toFixed(2)}</p>
                )}
              </div>
            )}

            <button
              onClick={manualCheck}
              disabled={manualChecking}
              className="btn-outline-gold w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 mb-3"
            >
              <RefreshCw size={14} className={manualChecking ? "animate-spin" : ""} />
              {manualChecking ? "Checking…" : "Check Payment Status"}
            </button>

            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/34635383712?text=${encodeURIComponent(
                  `Hi! I have booking reference ${data?.confirmationCode ?? ""} and need to complete payment of €${data?.totalAmount?.toFixed(2) ?? ""}.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="btn-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Complete via WhatsApp
              </a>
              <Link href="/" className="btn-outline-gold w-full py-3.5 rounded-xl font-semibold">
                Back to Home
              </Link>
            </div>
          </>
        )}
        <p className="text-dark-500 text-xs mt-6">
          Élite BCN Transfers · +34 635 383 712 · vtcbcn2025@gmail.com
        </p>
      </motion.div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <SuccessInner />
      </Suspense>
    </>
  );
}
