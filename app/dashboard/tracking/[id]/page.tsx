"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowLeft, MapPin, Clock, Phone, MessageCircle,
  Car, Star, CheckCircle2, Loader2, AlertCircle, Navigation
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { STATUS_LABELS, type BookingStatus } from "@/types";

const LiveMap = dynamic(() => import("@/components/dashboard/LiveMap"), { ssr: false, loading: () => (
  <div className="w-full h-full bg-dark-800 rounded-2xl flex items-center justify-center min-h-[300px] animate-pulse">
    <Loader2 className="text-gold-500 animate-spin" size={28} />
  </div>
) });

interface BookingDetails {
  id: string;
  confirmationCode: string;
  status: BookingStatus;
  pickupAddress: string;
  dropoffAddress: string | null;
  pickupDatetime: string;
  totalAmount: number;
  flightNumber?: string | null;
  driver?: {
    user: { name?: string | null; image?: string | null; phone?: string | null };
    rating: number;
    vehicles: { make: string; model: string; licensePlate: string; color?: string }[];
  } | null;
  tracking?: { lat: number; lng: number; speed?: number; heading?: number; createdAt: string }[];
}

const DRIVER_STATES = [
  { key: "CONFIRMED",       label: "Booking Confirmed",  done: true },
  { key: "DRIVER_ASSIGNED", label: "Driver Assigned",    done: false },
  { key: "IN_PROGRESS",     label: "Driver En Route",    done: false },
  { key: "IN_PROGRESS",     label: "Passenger On Board", done: false },
  { key: "COMPLETED",       label: "Trip Completed",     done: false },
];

export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setBooking(data);
        setLastUpdated(new Date());
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchBooking().then(() => setLoading(false));
    // Poll every 15 seconds for live updates
    const interval = setInterval(fetchBooking, 15000);
    return () => clearInterval(interval);
  }, [fetchBooking]);

  const lastTracking = booking?.tracking?.slice(-1)[0];
  const driverLocation = lastTracking ? { lat: lastTracking.lat, lng: lastTracking.lng } : null;

  const getStepIndex = (status: BookingStatus) => {
    const map: Record<string, number> = {
      CONFIRMED: 0, DRIVER_ASSIGNED: 1, IN_PROGRESS: 2, COMPLETED: 4,
    };
    return map[status] ?? 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-gold-500 animate-spin" />
          <p className="text-dark-400 text-sm">Loading tracking…</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={40} className="text-dark-600 mx-auto mb-3" />
        <p className="text-white font-semibold">Booking not found</p>
        <Link href="/dashboard/bookings" className="text-gold-400 text-sm mt-2 inline-block">← Back to bookings</Link>
      </div>
    );
  }

  const vehicle = booking.driver?.vehicles?.[0];
  const stepIndex = getStepIndex(booking.status);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">

      {/* Back */}
      <Link href="/dashboard/bookings" className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm">
        <ArrowLeft size={14} /> Back to bookings
      </Link>

      {/* Header */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.08]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Navigation size={16} className="text-gold-500" />
              <span className="text-gold-400 text-xs uppercase tracking-widest font-medium">Live Tracking</span>
            </div>
            <h1 className="font-display text-2xl text-white mb-1">#{booking.confirmationCode}</h1>
            <p className="text-dark-400 text-sm">
              {new Date(booking.pickupDatetime).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl text-gold-400">{formatCurrency(booking.totalAmount)}</p>
            {lastUpdated && (
              <p className="text-dark-500 text-[10px] mt-1">
                Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Map — 3/5 */}
        <div className="lg:col-span-3">
          <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.08]" style={{ height: "420px" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white text-sm font-medium">Live Map</span>
              </div>
              <span className="text-dark-500 text-xs">Powered by OpenStreetMap</span>
            </div>
            <div className="h-[calc(100%-49px)]">
              <LiveMap
                driverLat={driverLocation?.lat}
                driverLng={driverLocation?.lng}
                pickupLat={41.2974}
                pickupLng={2.0833}
                dropoffLat={41.3851}
                dropoffLng={2.1734}
                trackingHistory={booking.tracking ?? []}
                driverStatus={booking.status}
              />
            </div>
          </div>
        </div>

        {/* Right panel — 2/5 */}
        <div className="lg:col-span-2 space-y-4">

          {/* Progress steps */}
          <div className="glass-card rounded-2xl p-5 border border-white/[0.08]">
            <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-4">Ride Status</p>
            <div className="space-y-3">
              {DRIVER_STATES.map((step, i) => {
                const done = i <= stepIndex;
                const active = i === stepIndex;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      done ? active ? "bg-gold-500 shadow-[0_0_12px_rgba(201,168,76,0.5)]" : "bg-gold-500/20 border border-gold-500/40" : "bg-dark-800 border border-white/[0.08]"
                    }`}>
                      {done && !active ? <CheckCircle2 size={14} className="text-gold-400" /> : active ? <div className="w-2 h-2 rounded-full bg-dark-950 animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-dark-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${done ? active ? "text-white font-semibold" : "text-gold-400" : "text-dark-500"}`}>
                        {step.label}
                      </p>
                    </div>
                    {active && (
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-1 rounded-full bg-gold-500 animate-bounce" />
                        <div className="w-1 h-1 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <div className="w-1 h-1 rounded-full bg-gold-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Driver card */}
          {booking.driver ? (
            <div className="glass-card rounded-2xl p-5 border border-white/[0.08]">
              <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-3">Your Driver</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-dark-700 border border-white/[0.1] flex items-center justify-center text-white font-bold text-lg overflow-hidden flex-shrink-0">
                  {booking.driver.user.image ? (
                    <img src={booking.driver.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    booking.driver.user.name?.[0]?.toUpperCase() ?? "D"
                  )}
                </div>
                <div>
                  <p className="text-white font-semibold">{booking.driver.user.name ?? "Your Driver"}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star size={11} className="text-gold-500 fill-gold-500" />
                    <span className="text-gold-400 text-xs">{booking.driver.rating?.toFixed(1) ?? "4.9"}</span>
                  </div>
                </div>
              </div>
              {vehicle && (
                <div className="bg-dark-800 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Car size={14} className="text-gold-500" />
                    <span className="text-white text-sm font-medium">{vehicle.make} {vehicle.model}</span>
                  </div>
                  <p className="text-dark-500 text-xs font-mono mt-1">{vehicle.licensePlate}</p>
                  {vehicle.color && <p className="text-dark-500 text-xs mt-0.5">{vehicle.color}</p>}
                </div>
              )}
              <div className="flex gap-2">
                {booking.driver.user.phone && (
                  <a
                    href={`tel:${booking.driver.user.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-800 border border-white/[0.08] text-dark-300 hover:text-white hover:border-white/[0.15] transition-all text-xs font-medium"
                  >
                    <Phone size={13} /> Call
                  </a>
                )}
                <a
                  href={`https://wa.me/34635383712?text=Booking ${booking.confirmationCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/15 transition-all text-xs font-medium"
                >
                  <MessageCircle size={13} /> WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-5 border border-white/[0.08] flex items-center gap-3">
              <Loader2 size={20} className="text-dark-500 animate-spin flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Assigning driver</p>
                <p className="text-dark-400 text-xs mt-0.5">You&apos;ll be notified when a driver accepts your booking</p>
              </div>
            </div>
          )}

          {/* Route summary */}
          <div className="glass-card rounded-2xl p-5 border border-white/[0.08]">
            <p className="text-dark-400 text-[10px] uppercase tracking-widest mb-3">Route</p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center pt-1 gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gold-500" />
                <div className="w-px flex-1 bg-gradient-to-b from-gold-500/60 to-dark-700 min-h-[20px]" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-dark-400" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <p className="text-[10px] text-dark-500 uppercase tracking-widest">Pickup</p>
                  <p className="text-white text-sm truncate">{booking.pickupAddress}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dark-500 uppercase tracking-widest">Drop-off</p>
                  <p className="text-dark-300 text-sm truncate">{booking.dropoffAddress ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
