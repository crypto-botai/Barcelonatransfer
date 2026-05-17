"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar, MapPin, Download, MessageCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

function SuccessInner() {
  const params = useSearchParams();
  const [booking, setBooking] = useState<{
    confirmationCode: string;
    pickupAddress: string;
    dropoffAddress: string;
    pickupDatetime: string;
    totalAmount: number;
    vehicleClass: string;
    guestEmail: string;
  } | null>(null);

  useEffect(() => {
    const bookingId = params.get("booking_id");
    if (!bookingId) return;
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .catch(() => {});
  }, [params]);

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-card rounded-2xl p-8 max-w-md w-full text-center"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 size={36} className="text-green-400" />
        </motion.div>

        <h1 className="font-display text-3xl text-white mb-2">Booking Confirmed!</h1>
        <p className="text-dark-400 mb-6">
          Your luxury transfer has been confirmed. Check your email for full details.
        </p>

        {booking && (
          <div className="bg-black/30 rounded-xl p-5 mb-6 text-left space-y-3 text-sm">
            <div className="text-center mb-3">
              <p className="text-dark-400 text-xs tracking-[0.2em] uppercase">Confirmation Code</p>
              <p className="font-display text-2xl text-gold-400 mt-1 tracking-widest">
                {booking.confirmationCode}
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-white/[0.06] pt-3">
              <MapPin size={14} className="text-gold-500 mt-0.5 flex-shrink-0" />
              <p className="text-dark-200">{booking.pickupAddress} → {booking.dropoffAddress}</p>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={14} className="text-gold-500 flex-shrink-0" />
              <p className="text-dark-200">{new Date(booking.pickupDatetime).toLocaleString()}</p>
            </div>
            <div className="border-t border-white/[0.06] pt-3 flex justify-between">
              <span className="text-dark-400">Total Paid</span>
              <span className="text-gold-400 font-semibold">€{booking.totalAmount}</span>
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
            Contact Driver Support
          </a>
        </div>

        <p className="text-dark-500 text-xs mt-4">
          A confirmation email has been sent to your inbox.
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
