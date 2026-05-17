"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import {
  ArrowRight, ArrowLeft, MapPin, Calendar, Clock, Users,
  User, Mail, Phone, MessageSquare, Plane, ChevronDown,
  Zap, Loader2, CheckCircle2, Briefcase
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { VEHICLE_CATALOG, type VehicleClass, type BookingFormData, type QuoteResponse } from "@/types";
import toast from "react-hot-toast";

const STEPS = [
  { id: 1, label: "Route" },
  { id: 2, label: "Vehicle" },
  { id: 3, label: "Details" },
  { id: 4, label: "Payment" },
];

declare global { interface Window { google: typeof google; } }

function BookingPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(1);

  const pickupRef  = useRef<HTMLInputElement>(null);
  const dropoffRef = useRef<HTMLInputElement>(null);
  const [mapsReady, setMapsReady] = useState(false);

  const [data, setData] = useState<Partial<BookingFormData>>({
    pickupAddress:  params.get("pickup")  ?? "",
    pickupLat:      parseFloat(params.get("pLat") ?? "0"),
    pickupLng:      parseFloat(params.get("pLng") ?? "0"),
    dropoffAddress: params.get("dropoff") ?? "",
    dropoffLat:     parseFloat(params.get("dLat") ?? "0"),
    dropoffLng:     parseFloat(params.get("dLng") ?? "0"),
    date:           params.get("date")    ?? "",
    time:           params.get("time")    ?? "",
    passengers:     parseInt(params.get("pax") ?? "2"),
    luggage:        0,
    vehicleClass:   (params.get("vehicle") as VehicleClass) ?? "BUSINESS",
    guestName:      "",
    guestEmail:     "",
    guestPhone:     "",
    flightNumber:   "",
    specialRequests: "",
  });

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load Google Maps
  useEffect(() => {
    if (window.google?.maps?.places) { setMapsReady(true); return; }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!key) return;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.onload = () => setMapsReady(true);
    document.head.appendChild(s);
  }, []);

  const attachAC = useCallback((
    input: HTMLInputElement,
    field: "pickup" | "dropoff"
  ) => {
    if (!mapsReady || !window.google) return;
    const ac = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: ["es", "fr", "pt", "ad"] },
      fields: ["formatted_address", "geometry"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      const address = place.formatted_address ?? input.value;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      if (field === "pickup")  setData((d) => ({ ...d, pickupAddress: address,  pickupLat: lat,  pickupLng: lng  }));
      if (field === "dropoff") setData((d) => ({ ...d, dropoffAddress: address, dropoffLat: lat, dropoffLng: lng }));
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady) return;
    if (pickupRef.current)  attachAC(pickupRef.current,  "pickup");
    if (dropoffRef.current) attachAC(dropoffRef.current, "dropoff");
  }, [mapsReady, attachAC, step]);

  const fetchQuote = useCallback(async (vehicleClass: VehicleClass) => {
    if (!data.pickupLat || !data.dropoffLat || !data.date || !data.time) return;
    setLoadingQuote(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: data.pickupLat, pickupLng: data.pickupLng,
          dropoffLat: data.dropoffLat, dropoffLng: data.dropoffLng,
          vehicleClass, pickupDatetime: `${data.date}T${data.time}`,
          passengers: data.passengers,
        }),
      });
      if (res.ok) setQuote(await res.json());
    } catch { /* silent */ } finally {
      setLoadingQuote(false);
    }
  }, [data.pickupLat, data.pickupLng, data.dropoffLat, data.dropoffLng, data.date, data.time, data.passengers]);

  useEffect(() => {
    if (step === 2 && data.vehicleClass) fetchQuote(data.vehicleClass);
  }, [step, data.vehicleClass, fetchQuote]);

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
      router.push(json.checkoutUrl);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const step1Valid = !!data.pickupLat && !!data.dropoffLat && !!data.date && !!data.time;
  const step3Valid = !!data.guestName && !!data.guestEmail && !!data.guestPhone;

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 bg-[#050505]">
        <div className="container mx-auto px-4 py-10 max-w-3xl">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-10 steps-line">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center relative z-10">
                <button
                  onClick={() => step > s.id && setStep(s.id)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    step === s.id  ? "step-active"   :
                    step >  s.id  ? "step-complete"  : "step-pending"
                  )}>
                    {step > s.id ? <CheckCircle2 size={16} /> : s.id}
                  </div>
                  <span className={cn(
                    "text-xs transition-colors hidden sm:block",
                    step === s.id ? "text-gold-400" : "text-dark-500"
                  )}>{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "w-16 sm:w-24 h-px mx-2 transition-colors duration-500",
                    step > s.id ? "bg-gold-500/40" : "bg-white/[0.06]"
                  )} />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ─── Step 1: Route ─── */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="glass-card rounded-2xl p-8">
                  <h2 className="font-display text-2xl text-white mb-6">Your Journey</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Pick-up Location</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-black" />
                        </div>
                        <input ref={pickupRef} type="text" defaultValue={data.pickupAddress}
                          onChange={(e) => setData((d) => ({ ...d, pickupAddress: e.target.value }))}
                          placeholder="Airport, hotel, address…"
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl" />
                      </div>
                    </div>
                    <div className="h-px bg-gold-500/10 mx-3" />
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Drop-off Location</label>
                      <div className="relative">
                        <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500" />
                        <input ref={dropoffRef} type="text" defaultValue={data.dropoffAddress}
                          onChange={(e) => setData((d) => ({ ...d, dropoffAddress: e.target.value }))}
                          placeholder="Destination…"
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Date</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <input type="date" value={data.date ?? ""} min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Time</label>
                        <div className="relative">
                          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <input type="time" value={data.time ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, time: e.target.value }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Passengers</label>
                        <div className="relative">
                          <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <select value={data.passengers} onChange={(e) => setData((d) => ({ ...d, passengers: Number(e.target.value) }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
                            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n} className="bg-[#111]">{n} passenger{n > 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Luggage bags</label>
                        <div className="relative">
                          <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <select value={data.luggage} onChange={(e) => setData((d) => ({ ...d, luggage: Number(e.target.value) }))}
                            className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
                            {Array.from({ length: 17 }, (_, i) => i).map((n) => (
                              <option key={n} value={n} className="bg-[#111]">{n} bag{n !== 1 ? "s" : ""}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setStep(2)} disabled={!step1Valid}
                      className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                      Select Vehicle <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 2: Vehicle ─── */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-4">
                  <div className="glass-card rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <p className="text-dark-400 text-xs uppercase tracking-wider">Route</p>
                      <p className="text-white text-sm mt-1">{data.pickupAddress} → {data.dropoffAddress}</p>
                    </div>
                    {loadingQuote && <Loader2 size={16} className="text-gold-500 animate-spin" />}
                  </div>

                  {VEHICLE_CATALOG.filter((v) => v.maxPassengers >= (data.passengers ?? 1)).map((v) => {
                    const sel = data.vehicleClass === v.class;
                    const pricing = quote && sel ? quote : null;
                    return (
                      <motion.button key={v.class} onClick={() => { setData((d) => ({ ...d, vehicleClass: v.class })); fetchQuote(v.class); }}
                        className={cn(
                          "w-full text-left rounded-xl border p-5 transition-all duration-200",
                          sel ? "border-gold-500/50 bg-gold-500/5" : "border-white/[0.06] bg-white/[0.02] hover:border-gold-500/20"
                        )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={cn("w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center",
                              sel ? "border-gold-500 bg-gold-500" : "border-white/20")}>
                              {sel && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                            </div>
                            <div>
                              <p className={cn("font-medium transition-colors", sel ? "text-gold-400" : "text-white")}>
                                {v.label}
                              </p>
                              <p className="text-dark-500 text-xs mt-0.5">{v.models.join(" / ")} · {v.maxPassengers} pax</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {pricing ? (
                              <>
                                <p className="font-display text-xl text-gold-400">{formatCurrency(pricing.totalAmount)}</p>
                                <p className="text-dark-500 text-xs">{pricing.distanceKm}km · {pricing.durationMin}min</p>
                              </>
                            ) : (
                              <p className="text-dark-500 text-xs">Select to price</p>
                            )}
                          </div>
                        </div>
                        {sel && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pl-8">
                            {v.features.slice(0, 4).map((f) => (
                              <span key={f} className="text-xs px-2 py-1 rounded-md bg-white/[0.04] text-dark-300">{f}</span>
                            ))}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button onClick={() => setStep(3)} disabled={!data.vehicleClass}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 3: Personal Details ─── */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="glass-card rounded-2xl p-8">
                  <h2 className="font-display text-2xl text-white mb-6">Passenger Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Full Name *</label>
                      <div className="relative">
                        <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                        <input required type="text" value={data.guestName ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, guestName: e.target.value }))}
                          placeholder="As on travel document" className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email *</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <input required type="email" value={data.guestEmail ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, guestEmail: e.target.value }))}
                            placeholder="you@email.com" className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Phone *</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                          <input required type="tel" value={data.guestPhone ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, guestPhone: e.target.value }))}
                            placeholder="+34..." className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Flight Number (optional)</label>
                      <div className="relative">
                        <Plane size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                        <input type="text" value={data.flightNumber ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, flightNumber: e.target.value }))}
                          placeholder="e.g. IB3456" className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Special Requests</label>
                      <div className="relative">
                        <MessageSquare size={14} className="absolute left-3.5 top-3.5 text-gold-500/60" />
                        <textarea rows={3} value={data.specialRequests ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, specialRequests: e.target.value }))}
                          placeholder="Child seat, accessibility needs, specific route…"
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm resize-none" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setStep(2)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                        <ArrowLeft size={16} /> Back
                      </button>
                      <button onClick={() => setStep(4)} disabled={!step3Valid}
                        className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                        Review & Pay <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── Step 4: Review & Pay ─── */}
            {step === 4 && quote && (
              <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-4">
                  <div className="glass-card rounded-2xl p-6">
                    <h2 className="font-display text-2xl text-white mb-5">Booking Summary</h2>
                    <div className="space-y-3 text-sm">
                      {[
                        ["Pick-up",    data.pickupAddress],
                        ["Drop-off",   data.dropoffAddress],
                        ["Date",       `${data.date} at ${data.time}`],
                        ["Vehicle",    VEHICLE_CATALOG.find((v) => v.class === data.vehicleClass)?.label],
                        ["Passengers", data.passengers],
                        ["Name",       data.guestName],
                        ["Email",      data.guestEmail],
                        ["Phone",      data.guestPhone],
                        data.flightNumber ? ["Flight", data.flightNumber] : null,
                      ].filter(Boolean).map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between border-b border-white/[0.04] pb-3">
                          <span className="text-dark-400">{label}</span>
                          <span className="text-white text-right max-w-xs">{String(value)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Price breakdown */}
                    <div className="mt-5 bg-black/30 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-dark-400">
                        <span>Base fare</span><span>{formatCurrency(quote.baseFare)}</span>
                      </div>
                      <div className="flex justify-between text-dark-400">
                        <span>Distance ({quote.distanceKm} km)</span><span>{formatCurrency(quote.distanceFare)}</span>
                      </div>
                      {quote.airportSurcharge > 0 && (
                        <div className="flex justify-between text-dark-400">
                          <span>Airport surcharge</span><span>{formatCurrency(quote.airportSurcharge)}</span>
                        </div>
                      )}
                      {quote.nightSurcharge > 0 && (
                        <div className="flex justify-between text-dark-400">
                          <span>Night surcharge</span><span>{formatCurrency(quote.nightSurcharge)}</span>
                        </div>
                      )}
                      <div className="border-t border-white/10 pt-3 flex justify-between">
                        <span className="text-white font-semibold">Total</span>
                        <span className="font-display text-xl text-gold-400">{formatCurrency(quote.totalAmount)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 text-xs text-dark-500">
                      <Zap size={12} className="text-gold-500" />
                      Fixed price. No surge pricing. Free cancellation 24h before pickup.
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                      <ArrowLeft size={16} /> Back
                    </button>
                    <button onClick={handlePay} disabled={submitting}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                      {submitting ? "Processing…" : `Pay ${formatCurrency(quote.totalAmount)}`}
                    </button>
                  </div>
                  <p className="text-center text-xs text-dark-500">
                    Secured by Stripe · 256-bit SSL · Apple Pay & Google Pay accepted
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
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
