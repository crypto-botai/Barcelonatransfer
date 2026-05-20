"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import {
  ArrowRight, ArrowLeft, MapPin, Calendar, Clock, Users,
  User, Mail, Phone, MessageSquare, Plane, Zap, Loader2,
  CheckCircle2, Briefcase, Car, Timer, Building2, Plus, Minus,
  Shield, CreditCard,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  VEHICLE_CATALOG, EXTRAS_CATALOG, BOOKING_TYPE_LABELS,
  type VehicleClass, type BookingFormData, type QuoteResponse,
  type BookingType, type BookingExtra,
} from "@/types";
import { DEFAULT_PRICING, HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import toast from "react-hot-toast";

// ─── Constants ──────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Journey" },
  { id: 2, label: "Vehicle" },
  { id: 3, label: "Details" },
  { id: 4, label: "Payment" },
];

const BOOKING_TYPES: { type: BookingType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "TRANSFER",  label: "Transfer",    icon: MapPin,     desc: "Airport, hotel, point-to-point" },
  { type: "HOURLY",    label: "By Hour",     icon: Timer,      desc: "Chauffeur for 2–12 hours" },
  { type: "DAY_HIRE",  label: "Full Day",    icon: Calendar,   desc: "8-hour full day service" },
  { type: "CORPORATE", label: "Corporate",   icon: Building2,  desc: "Business account bookings" },
];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const HOURS_OPTIONS = [4, 5, 6, 8, 10, 12];

function todayStr()    { return new Date().toISOString().split("T")[0]; }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }

function roundUpToNext30(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 90); // at least 1.5h from now
  const m = now.getMinutes() < 30 ? "30" : "00";
  if (now.getMinutes() >= 30) now.setHours(now.getHours() + 1);
  return `${now.getHours().toString().padStart(2, "0")}:${m}`;
}

// ─── SumUp Payment Modal ────────────────────────────────────
function SumUpPaymentModal({
  checkoutId,
  bookingId,
  total,
  onClose,
}: {
  checkoutId: string;
  bookingId: string;
  total: number;
  onClose: () => void;
}) {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const script = document.createElement("script");
    script.src = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SumUpCard = (window as any).SumUpCard;
      if (!SumUpCard) return;
      SumUpCard.mount({
        id: "sumup-card-widget",
        checkoutId,
        onResponse: (type: string) => {
          if (type === "success") {
            window.location.href = `/booking/success?booking_id=${bookingId}`;
          } else if (type === "error" || type === "expired") {
            window.location.href = `/booking/failed?booking_id=${bookingId}`;
          }
        },
      });
    };

    return () => {
      script.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-gold-500/20">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              <p className="text-gold-400 text-xs uppercase tracking-[0.2em] font-medium">Secure Payment</p>
              <p className="text-white font-display text-lg mt-0.5">Complete Your Booking</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-display text-xl text-gold-400">{formatCurrency(total)}</p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white hover:border-white/30 transition-all text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* SumUp widget mounts here */}
          <div className="p-6">
            <div id="sumup-card-widget" className="min-h-[280px]" />
          </div>

          <div className="px-6 pb-4 text-center">
            <p className="text-dark-500 text-xs">
              🔒 Secured by SumUp · PCI DSS Level 1 · 256-bit SSL encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Inner Component ───────────────────────────────────
function BookingPageInner() {
  const params = useSearchParams();

  const hasPrefilledJourney = !!(
    params.get("pLat") && params.get("date") && params.get("time") &&
    (params.get("dLat") || params.get("bookingType") === "HOURLY" || params.get("bookingType") === "DAY_HIRE")
  );

  const [step, setStep] = useState(hasPrefilledJourney ? 2 : 1);

  const [data, setData] = useState<Partial<BookingFormData>>({
    bookingType:     "TRANSFER",
    pickupAddress:   params.get("pickup")   ?? "",
    pickupLat:       parseFloat(params.get("pLat") ?? "0"),
    pickupLng:       parseFloat(params.get("pLng") ?? "0"),
    dropoffAddress:  params.get("dropoff")  ?? "",
    dropoffLat:      parseFloat(params.get("dLat") ?? "0"),
    dropoffLng:      parseFloat(params.get("dLng") ?? "0"),
    date:            params.get("date")     ?? "",
    time:            params.get("time")     ?? "",
    passengers:      parseInt(params.get("pax") ?? "2"),
    luggage:         0,
    durationHours:   4,
    vehicleClass:    (params.get("vehicle") as VehicleClass) ?? "BUSINESS",
    guestName:       "",
    guestEmail:      "",
    guestPhone:      "",
    flightNumber:    "",
    specialRequests: "",
    extras:          [],
  });

  const [quote,        setQuote]        = useState<QuoteResponse | null>(null);
  const [loadingQ,     setLoadingQ]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [paymentOpen,  setPaymentOpen]  = useState(false);
  const [checkoutId,   setCheckoutId]   = useState<string | null>(null);
  const [bookingId,    setBookingId]    = useState<string | null>(null);

  const bookingType = data.bookingType ?? "TRANSFER";

  // ── Quote fetcher ──────────────────────────────────────────
  const fetchQuote = useCallback(async (vehicleClass: VehicleClass, bType?: BookingType) => {
    const type = bType ?? bookingType;
    if (!data.pickupLat || !data.date || !data.time) return;
    if (type === "TRANSFER" && (!data.dropoffLat)) return;

    setLoadingQ(true);
    try {
      const body: Record<string, unknown> = {
        bookingType:    type,
        pickupLat:      data.pickupLat,
        pickupLng:      data.pickupLng,
        vehicleClass,
        pickupDatetime: `${data.date}T${data.time}`,
        passengers:     data.passengers,
      };
      if (type === "TRANSFER" || type === "CORPORATE") {
        body.dropoffLat = data.dropoffLat;
        body.dropoffLng = data.dropoffLng;
      }
      if (type === "HOURLY") body.durationHours = data.durationHours ?? 3;

      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setQuote(await res.json());
    } catch { /* silent */ } finally {
      setLoadingQ(false);
    }
  }, [data.pickupLat, data.pickupLng, data.dropoffLat, data.dropoffLng, data.date, data.time, data.passengers, data.durationHours, bookingType]);

  // Auto-fetch quote when arriving with pre-filled journey from instant quote
  useEffect(() => {
    if (hasPrefilledJourney && data.vehicleClass && data.pickupLat && data.date && data.time) {
      fetchQuote(data.vehicleClass as VehicleClass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Extras helpers ─────────────────────────────────────────
  const extrasTotal = (data.extras ?? []).reduce((s, e) => s + e.price * e.quantity, 0);
  const grandTotal  = (quote?.totalAmount ?? 0) + extrasTotal;

  const toggleExtra = (id: string) => {
    const catalog = EXTRAS_CATALOG.find((e) => e.id === id)!;
    const existing = (data.extras ?? []).find((e) => e.id === id);
    if (existing) {
      setData((d) => ({ ...d, extras: (d.extras ?? []).filter((e) => e.id !== id) }));
    } else {
      setData((d) => ({
        ...d,
        extras: [...(d.extras ?? []), { id, label: catalog.label, price: catalog.price, quantity: 1 }],
      }));
    }
  };

  const updateExtraQty = (id: string, delta: number) => {
    const catalog = EXTRAS_CATALOG.find((e) => e.id === id)!;
    setData((d) => ({
      ...d,
      extras: (d.extras ?? []).map((e) => {
        if (e.id !== id) return e;
        const qty = Math.min(Math.max(1, e.quantity + delta), catalog.maxQty);
        return { ...e, quantity: qty };
      }),
    }));
  };

  // ── Quick date/time selectors ──────────────────────────────
  const quickSelect = (opt: "now1h" | "tomorrowAM" | "tomorrowPM") => {
    if (opt === "now1h") {
      setData((d) => ({ ...d, date: todayStr(), time: roundUpToNext30() }));
    } else if (opt === "tomorrowAM") {
      setData((d) => ({ ...d, date: tomorrowStr(), time: "09:00" }));
    } else {
      setData((d) => ({ ...d, date: tomorrowStr(), time: "14:00" }));
    }
  };

  // ── Step navigation ────────────────────────────────────────
  const goToStep2 = () => {
    setStep(2);
    if (data.vehicleClass) fetchQuote(data.vehicleClass);
  };

  const step1Valid =
    !!data.pickupLat && !!data.date && !!data.time &&
    (bookingType !== "TRANSFER" || !!data.dropoffLat);
  const step3Valid = !!data.guestName && !!data.guestEmail && !!data.guestPhone;

  // ── Pay ────────────────────────────────────────────────────
  const handlePay = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, quote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Booking failed");

      setBookingId(json.bookingId);

      if (json.checkoutId) {
        // SumUp configured — open embedded payment modal
        setCheckoutId(json.checkoutId);
        setPaymentOpen(true);
      } else {
        // Fallback (SumUp not configured) — go to pending page
        window.location.href = json.checkoutUrl;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 bg-[#050505]">
        <div className="container mx-auto px-4 py-10 max-w-3xl">

          {/* ── Step Indicator ── */}
          <div className="flex items-center justify-center mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    step === s.id ? "step-active" : step > s.id ? "step-complete" : "step-pending"
                  )}>
                    {step > s.id ? <CheckCircle2 size={16} /> : s.id}
                  </div>
                  <span className={cn("text-xs hidden sm:block transition-colors", step === s.id ? "text-gold-400" : "text-dark-500")}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("w-12 sm:w-20 h-px mx-2 transition-colors duration-500", step > s.id ? "bg-gold-500/40" : "bg-white/[0.06]")} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ══════════════════════════════════════════════
                STEP 1: Journey
            ══════════════════════════════════════════════ */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="glass-card rounded-2xl p-6 sm:p-8">
                  <h2 className="font-display text-2xl text-white mb-6">Plan Your Journey</h2>

                  {/* ── Booking type tabs ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    {BOOKING_TYPES.map(({ type, label, icon: Icon, desc }) => {
                      const sel = bookingType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => setData((d) => ({ ...d, bookingType: type, quote: undefined }))}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200 text-xs",
                            sel
                              ? "border-gold-500/60 bg-gold-500/8 text-gold-400"
                              : "border-white/[0.06] text-dark-400 hover:border-gold-500/20 hover:text-gold-400"
                          )}
                        >
                          <Icon size={18} className={sel ? "text-gold-500" : "text-dark-500"} />
                          <span className="font-medium">{label}</span>
                          <span className="text-[10px] text-dark-500 hidden sm:block leading-tight">{desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-4">
                    {/* Pickup */}
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Pick-up Location</label>
                      <AddressAutocomplete
                        value={data.pickupAddress ?? ""}
                        onChange={(v) => setData((d) => ({ ...d, pickupAddress: v.address, pickupLat: v.lat, pickupLng: v.lng }))}
                        placeholder="Airport, hotel, address…"
                        icon={<div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-black" /></div>}
                      />
                    </div>

                    {/* Dropoff (Transfer / Corporate only) */}
                    {(bookingType === "TRANSFER" || bookingType === "CORPORATE") && (
                      <div>
                        <div className="h-px bg-gold-500/10 mx-3 mb-4" />
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Drop-off Location</label>
                        <AddressAutocomplete
                          value={data.dropoffAddress ?? ""}
                          onChange={(v) => setData((d) => ({ ...d, dropoffAddress: v.address, dropoffLat: v.lat, dropoffLng: v.lng }))}
                          placeholder="Destination…"
                        />
                      </div>
                    )}

                    {/* Duration (Hourly only) */}
                    {bookingType === "HOURLY" && (
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                          Duration <span className="text-dark-600 normal-case tracking-normal">(minimum 4 hours)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {HOURS_OPTIONS.map((h) => (
                            <button
                              key={h}
                              onClick={() => setData((d) => ({ ...d, durationHours: h }))}
                              className={cn(
                                "px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                                data.durationHours === h
                                  ? "border-gold-500 bg-gold-500/10 text-gold-400"
                                  : "border-white/10 text-dark-400 hover:border-gold-500/30 hover:text-gold-400"
                              )}
                            >
                              {h}h
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Day hire info */}
                    {bookingType === "DAY_HIRE" && (
                      <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-4 text-sm text-dark-300">
                        <p className="text-gold-400 font-medium mb-1">Full Day Hire — 8 Hours</p>
                        <p>Your chauffeur is at your disposal for the full day. Includes up to 200km. Additional km billed at standard rate.</p>
                      </div>
                    )}

                    {/* Date & Time */}
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">Date & Time</label>

                      {/* Quick select */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {([
                          ["In 1.5 Hours",   "now1h"],
                          ["Tomorrow 9 AM",  "tomorrowAM"],
                          ["Tomorrow 2 PM",  "tomorrowPM"],
                        ] as const).map(([label, opt]) => (
                          <button
                            key={opt}
                            onClick={() => quickSelect(opt)}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-dark-400 hover:border-gold-500/30 hover:text-gold-400 transition-all"
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input
                            type="date"
                            value={data.date ?? ""}
                            min={todayStr()}
                            onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm"
                          />
                        </div>
                        <div className="relative">
                          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <select
                            value={data.time ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, time: e.target.value }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none"
                          >
                            <option value="" className="bg-[#111]">Select time…</option>
                            {TIME_SLOTS.map((t) => (
                              <option key={t} value={t} className="bg-[#111]">{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Passengers & luggage */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Passengers</label>
                        <div className="relative">
                          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <select
                            value={data.passengers}
                            onChange={(e) => setData((d) => ({ ...d, passengers: Number(e.target.value) }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none"
                          >
                            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n} className="bg-[#111]">{n} passenger{n > 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Luggage</label>
                        <div className="relative">
                          <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <select
                            value={data.luggage}
                            onChange={(e) => setData((d) => ({ ...d, luggage: Number(e.target.value) }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none"
                          >
                            {Array.from({ length: 17 }, (_, i) => i).map((n) => (
                              <option key={n} value={n} className="bg-[#111]">{n} bag{n !== 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={goToStep2}
                      disabled={!step1Valid}
                      className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                      Select Vehicle <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 2: Vehicle Selection
            ══════════════════════════════════════════════ */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-4">
                  {/* Route summary */}
                  <div className="glass-card rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-dark-400 text-xs uppercase tracking-wider">{BOOKING_TYPE_LABELS[bookingType]}</p>
                      <p className="text-white text-sm mt-1 truncate max-w-[260px]">
                        {data.pickupAddress}
                        {data.dropoffAddress && ` → ${data.dropoffAddress}`}
                        {bookingType === "HOURLY" && ` · ${data.durationHours}h`}
                      </p>
                    </div>
                    {loadingQ && <Loader2 size={16} className="text-gold-500 animate-spin flex-shrink-0" />}
                  </div>

                  {/* Vehicle cards */}
                  {VEHICLE_CATALOG
                    .filter((v) => v.maxPassengers >= (data.passengers ?? 1))
                    .map((v) => {
                      const sel = data.vehicleClass === v.class;
                      const pricing = quote && sel ? quote : null;
                      const minFare = DEFAULT_PRICING[v.class].minimumFare;
                      const minHours = MIN_HOURLY_HOURS[v.class] ?? 4;
                      const selectedHours = bookingType === "DAY_HIRE" ? 8 : Math.max(data.durationHours ?? 4, minHours);
                      const hourlyRate = bookingType === "HOURLY" || bookingType === "DAY_HIRE"
                        ? HOURLY_RATES[v.class] * selectedHours
                        : null;

                      return (
                        <motion.button
                          key={v.class}
                          onClick={() => {
                            setData((d) => ({ ...d, vehicleClass: v.class }));
                            fetchQuote(v.class);
                          }}
                          className={cn(
                            "w-full text-left rounded-xl border overflow-hidden transition-all duration-200",
                            sel
                              ? "border-gold-500/60 bg-gold-500/5 shadow-lg shadow-gold-500/10"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-gold-500/20"
                          )}
                        >
                          <div className="flex">
                            {/* Vehicle image */}
                            <div className="relative w-28 sm:w-36 flex-shrink-0 aspect-[4/3] bg-[#e8e8e8]">
                              <Image
                                src={v.image}
                                alt={v.label}
                                fill
                                sizes="144px"
                                className="object-contain p-2"
                              />
                              {v.badge && (
                                <div className="absolute top-2 left-2 z-10">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    v.badge === "VIP" ? "bg-gold-500 text-black" :
                                    v.badge === "Popular" ? "bg-blue-500 text-white" :
                                    "bg-green-500 text-white"
                                  }`}>{v.badge}</span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <div className={cn(
                                      "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                      sel ? "border-gold-500 bg-gold-500" : "border-white/20"
                                    )}>
                                      {sel && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                    </div>
                                    <p className={cn("font-medium text-sm", sel ? "text-gold-400" : "text-white")}>{v.label}</p>
                                  </div>
                                  <p className="text-dark-500 text-xs ml-5">{v.models[0]} · {v.maxPassengers} pax</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {pricing ? (
                                    <>
                                      <p className="font-display text-lg text-gold-400">{formatCurrency(pricing.totalAmount)}</p>
                                      <p className="text-dark-500 text-[10px]">
                                        {pricing.distanceKm > 0 ? `${pricing.distanceKm}km` : `${pricing.hours ?? data.durationHours}h`}
                                      </p>
                                    </>
                                  ) : hourlyRate !== null ? (
                                    <>
                                      <p className="font-display text-lg text-gold-400">{formatCurrency(hourlyRate)}</p>
                                      <p className="text-dark-500 text-[10px]">{formatCurrency(HOURLY_RATES[v.class])}/h · {selectedHours}h</p>
                                    </>
                                  ) : (
                                    <p className="text-dark-500 text-xs">from {formatCurrency(minFare)}</p>
                                  )}
                                </div>
                              </div>

                              {sel && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {v.features.slice(0, 3).map((f) => (
                                    <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-dark-300">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                  }

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!data.vehicleClass}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 3: Details & Extras
            ══════════════════════════════════════════════ */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-4">
                  {/* Personal info */}
                  <div className="glass-card rounded-2xl p-6 sm:p-8">
                    <h2 className="font-display text-2xl text-white mb-6">Passenger Details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Full Name *</label>
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input
                            required type="text" value={data.guestName ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, guestName: e.target.value }))}
                            placeholder="As on travel document"
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email *</label>
                          <div className="relative">
                            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                            <input
                              required type="email" value={data.guestEmail ?? ""}
                              onChange={(e) => setData((d) => ({ ...d, guestEmail: e.target.value }))}
                              placeholder="you@email.com"
                              className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Phone *</label>
                          <div className="relative">
                            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                            <input
                              required type="tel" value={data.guestPhone ?? ""}
                              onChange={(e) => setData((d) => ({ ...d, guestPhone: e.target.value }))}
                              placeholder="+34 6xx xxx xxx"
                              className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Flight number — airport transfers only */}
                      {(bookingType === "TRANSFER" || bookingType === "CORPORATE") && (
                        <div>
                          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                            Flight Number <span className="text-dark-600">(optional)</span>
                          </label>
                          <div className="relative">
                            <Plane size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                            <input
                              type="text" value={data.flightNumber ?? ""}
                              onChange={(e) => setData((d) => ({ ...d, flightNumber: e.target.value }))}
                              placeholder="e.g. IB3456 or VY1234"
                              className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                          Additional Notes <span className="text-dark-600">(optional)</span>
                        </label>
                        <div className="relative">
                          <MessageSquare size={14} className="absolute left-3.5 top-3.5 text-gold-500/60 pointer-events-none" />
                          <textarea
                            rows={2} value={data.specialRequests ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, specialRequests: e.target.value }))}
                            placeholder="Any specific instructions for your driver…"
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  <div className="glass-card rounded-2xl p-6 sm:p-8">
                    <h2 className="font-display text-xl text-white mb-2">Add Extras</h2>
                    <p className="text-dark-400 text-sm mb-5">Enhance your journey with optional add-ons</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {EXTRAS_CATALOG.map((extra) => {
                        const selected = (data.extras ?? []).find((e) => e.id === extra.id);
                        return (
                          <div
                            key={extra.id}
                            className={cn(
                              "rounded-xl border p-4 cursor-pointer transition-all duration-200",
                              selected
                                ? "border-gold-500/50 bg-gold-500/5"
                                : "border-white/[0.06] hover:border-gold-500/20"
                            )}
                            onClick={() => toggleExtra(extra.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3">
                                <span className="text-xl leading-none mt-0.5">{extra.icon}</span>
                                <div>
                                  <p className={cn("text-sm font-medium", selected ? "text-gold-400" : "text-white")}>
                                    {extra.label}
                                  </p>
                                  <p className="text-dark-500 text-xs mt-0.5">{extra.description}</p>
                                  <p className="text-gold-500 text-xs mt-1 font-medium">{extra.priceLabel}</p>
                                </div>
                              </div>
                              <div className={cn(
                                "w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all",
                                selected ? "border-gold-500 bg-gold-500" : "border-white/20"
                              )}>
                                {selected && <CheckCircle2 size={12} className="text-black" />}
                              </div>
                            </div>

                            {/* Quantity selector for selected extras with maxQty > 1 */}
                            {selected && extra.maxQty > 1 && (
                              <div
                                className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs text-dark-400">Quantity:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateExtraQty(extra.id, -1)}
                                    className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-dark-300 hover:border-gold-500/40"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <span className="text-white text-sm w-4 text-center">{selected.quantity}</span>
                                  <button
                                    onClick={() => updateExtraQty(extra.id, 1)}
                                    disabled={selected.quantity >= extra.maxQty}
                                    className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-dark-300 hover:border-gold-500/40 disabled:opacity-40"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                                {extra.price > 0 && (
                                  <span className="text-gold-400 text-xs ml-auto">
                                    {formatCurrency(extra.price * selected.quantity)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      disabled={!step3Valid}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      Review & Pay <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 4: Review & Pay
            ══════════════════════════════════════════════ */}
            {step === 4 && quote && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-4">
                  {/* Summary card */}
                  <div className="glass-card rounded-2xl p-6">
                    <h2 className="font-display text-2xl text-white mb-5">Booking Summary</h2>
                    <div className="space-y-2.5 text-sm">
                      {([
                        ["Service",      BOOKING_TYPE_LABELS[bookingType]],
                        ["Pick-up",      data.pickupAddress],
                        ...(data.dropoffAddress ? [["Drop-off", data.dropoffAddress]] : []),
                        ["Date & Time",  `${data.date} at ${data.time}`],
                        ["Vehicle",      VEHICLE_CATALOG.find((v) => v.class === data.vehicleClass)?.label ?? ""],
                        ["Passengers",   String(data.passengers)],
                        ["Luggage",      `${data.luggage} bags`],
                        ["Name",         data.guestName],
                        ["Email",        data.guestEmail],
                        ["Phone",        data.guestPhone],
                        ...(data.flightNumber ? [["Flight", data.flightNumber]] : []),
                        ...(bookingType === "HOURLY" ? [["Duration", `${data.durationHours}h`]] : []),
                      ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                        <div key={label} className="flex justify-between border-b border-white/[0.04] pb-2.5">
                          <span className="text-dark-400">{label}</span>
                          <span className="text-white text-right max-w-xs truncate">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Pricing breakdown */}
                    <div className="mt-5 bg-black/30 rounded-xl p-4 space-y-2 text-sm">
                      {quote.vatAmount > 0 ? (
                        /* Fixed-route pricing: transfer price + VAT only */
                        <>
                          <div className="flex justify-between text-dark-400">
                            <span>Transfer price</span>
                            <span>{formatCurrency(quote.baseFare)}</span>
                          </div>
                          <div className="flex justify-between text-dark-400">
                            <span>VAT (10%)</span>
                            <span>{formatCurrency(quote.vatAmount)}</span>
                          </div>
                        </>
                      ) : (
                        /* Dynamic pricing breakdown */
                        <>
                          <div className="flex justify-between text-dark-400">
                            <span>Base fare</span>
                            <span>{formatCurrency(quote.baseFare)}</span>
                          </div>
                          {quote.distanceFare > 0 && (
                            <div className="flex justify-between text-dark-400">
                              <span>Distance ({quote.distanceKm} km)</span>
                              <span>{formatCurrency(quote.distanceFare)}</span>
                            </div>
                          )}
                          {quote.airportSurcharge > 0 && (
                            <div className="flex justify-between text-dark-400">
                              <span>Airport surcharge</span>
                              <span>{formatCurrency(quote.airportSurcharge)}</span>
                            </div>
                          )}
                          {quote.nightSurcharge > 0 && (
                            <div className="flex justify-between text-dark-400">
                              <span>Night surcharge</span>
                              <span>{formatCurrency(quote.nightSurcharge)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Extras */}
                      {(data.extras ?? []).filter((e) => e.price > 0).map((e) => (
                        <div key={e.id} className="flex justify-between text-dark-400">
                          <span>{e.label} {e.quantity > 1 ? `×${e.quantity}` : ""}</span>
                          <span>{formatCurrency(e.price * e.quantity)}</span>
                        </div>
                      ))}

                      <div className="border-t border-white/10 pt-3 flex justify-between">
                        <span className="text-white font-semibold">Total</span>
                        <span className="font-display text-xl text-gold-400">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>

                    {/* Guarantees */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs text-dark-500">
                      <span className="flex items-center gap-1"><Zap size={11} className="text-gold-500" /> Fixed price</span>
                      <span className="flex items-center gap-1"><Shield size={11} className="text-gold-500" /> Free cancellation 24h before</span>
                      <span className="flex items-center gap-1"><CreditCard size={11} className="text-gold-500" /> Secure SumUp payment</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button
                      onClick={handlePay}
                      disabled={submitting}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {submitting ? "Processing…" : `Pay ${formatCurrency(grandTotal)}`}
                    </button>
                  </div>

                  <p className="text-center text-xs text-dark-500 pb-4">
                    Secured by SumUp · PCI DSS Level 1 · Apple Pay & Google Pay accepted
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* SumUp Payment Modal */}
      {paymentOpen && checkoutId && bookingId && (
        <SumUpPaymentModal
          checkoutId={checkoutId}
          bookingId={bookingId}
          total={grandTotal}
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </>
  );
}

export default function BookPage() {
  return (
    <Suspense>
      <BookingPageInner />
    </Suspense>
  );
}
