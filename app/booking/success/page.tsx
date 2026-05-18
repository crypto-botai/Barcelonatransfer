"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Calendar, MapPin, MessageCircle, Download } from "lucide-react";
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
  const [data,    setData]    = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }

    const verify = async () => {
      try {
        const res = await fetch(`/api/payments/verify?booking_id=${bookingId}`);
        const json = await res.json();
        setData(json);

        if (json.status === "PENDING" && attempts < 6) {
          setTimeout(() => setAttempts((a) => a + 1), 3000);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };

    verify();
  }, [bookingId, attempts]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="w-20 h-20 rounded-full border-2 border-gold-500/30 border-t-gold-500 animate-spin mx-auto mb-6" />
          <p className="text-dark-400">Confirming your payment…</p>
        </motion.div>
      </main>
    );
  }

  const isPaid   = data?.status === "PAID";
  const isFailed = data?.status === "FAILED";

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
              Your payment could not be processed. No charge was made. Please try again.
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
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-6">
              <Clock size={36} className="text-yellow-400" />
            </div>
            <h1 className="font-display text-3xl text-white mb-2">Payment Pending</h1>
            <p className="text-dark-400 mb-8">
              Your payment is being processed. You will receive a confirmation email shortly.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/" className="btn-gold w-full py-3.5 rounded-xl font-semibold">
                Back to Home
              </Link>
              <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer"
                className="btn-outline-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
                <MessageCircle size={16} /> Contact Support
              </a>
            </div>
          </>
        )}
        <p className="text-dark-500 text-xs mt-6">
          Secured by SumUp · PCI DSS Level 1 Certified
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
