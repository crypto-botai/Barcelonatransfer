"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import AddressAutocomplete, { type QuickZone } from "@/components/booking/AddressAutocomplete";
import {
  ArrowRight, ArrowLeft, MapPin, Calendar, Clock, Users,
  User, Mail, Phone, MessageSquare, Plane, Zap, Loader2,
  CheckCircle2, Briefcase, Timer, Building2, Plus, Minus,
  Shield, CreditCard, Tag, X, AlertCircle, MessageCircle,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  VEHICLE_CATALOG, EXTRAS_CATALOG, BOOKING_TYPE_LABELS, FLEET_TO_DB_CLASS,
  type FleetVehicle, type VehicleClass, type BookingFormData, type QuoteResponse,
  type BookingType,
} from "@/types";
import { getFleetFromPrice, HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import toast from "react-hot-toast";

// Addresses use short non-ambiguous strings so resolveZone() always identifies
// the correct zone — no province names that could shadow the city name.
const PICKUP_QUICK_ZONES: QuickZone[] = [
  // ── Airports / Hubs ───────────────────────────────────────────────────────
  { label: "Barcelona Airport — T1", sublabel: "Terminal 1 · El Prat de Llobregat", address: "Terminal 1, El Prat Airport BCN",              lat: 41.2971, lng: 2.0785, icon: "airport"  },
  { label: "Barcelona Airport — T2", sublabel: "Terminal 2 · El Prat de Llobregat", address: "Terminal 2, El Prat Airport BCN",              lat: 41.2894, lng: 2.0718, icon: "airport"  },
  { label: "Barcelona City Centre",  sublabel: "Passeig de Gràcia / Eixample",      address: "Passeig de Gràcia, Barcelona city centre",    lat: 41.3916, lng: 2.1649, icon: "city"     },
  { label: "Barcelona Cruise Port",  sublabel: "Moll Adossat · World Trade Centre",  address: "Moll Adossat, cruise terminal port Barcelona", lat: 41.3611, lng: 2.1761, icon: "port"    },
  { label: "Barcelona Sants Station",sublabel: "AVE · Long-distance trains",         address: "Estació de Sants, Barcelona sants station",   lat: 41.3794, lng: 2.1401, icon: "train"   },
  { label: "Girona Airport (GRO)",   sublabel: "Costa Brava Airport (GRO)",          address: "Girona Costa Brava Airport, Vilobi",          lat: 41.9011, lng: 2.7604, icon: "airport"  },
  { label: "Andorra la Vella",       sublabel: "Principality of Andorra",            address: "Andorra la Vella, Andorra",                   lat: 42.5063, lng: 1.5218, icon: "landmark" },
  { label: "Montserrat",             sublabel: "Monastery · 1h from BCN",            address: "Montserrat Monastery, Monistrol de Montserrat",lat: 41.5928, lng: 1.8363, icon: "landmark" },
  // ── Costa Dorada ─────────────────────────────────────────────────────────
  { label: "Castelldefels",     sublabel: "Costa Dorada · 25 min",  address: "Castelldefels, Baix Llobregat",              lat: 41.2800, lng: 1.9780, icon: "landmark" },
  { label: "Sitges",            sublabel: "Costa Dorada · 35 min",  address: "Sitges, Garraf",                             lat: 41.2369, lng: 1.8109, icon: "landmark" },
  { label: "Cubelles",          sublabel: "Costa Dorada · 45 min",  address: "Cubelles, Garraf",                           lat: 41.2134, lng: 1.6764, icon: "landmark" },
  { label: "Calafell",          sublabel: "Costa Dorada · 50 min",  address: "Calafell, Baix Penedes",                     lat: 41.1977, lng: 1.5675, icon: "landmark" },
  { label: "Vendrell",          sublabel: "Costa Dorada · 55 min",  address: "El Vendrell, Baix Penedes",                  lat: 41.2172, lng: 1.5374, icon: "landmark" },
  { label: "Tarragona",         sublabel: "Costa Dorada · 1h",      address: "Tarragona city centre",                      lat: 41.1189, lng: 1.2445, icon: "landmark" },
  { label: "La Pineda",         sublabel: "Costa Dorada · 1h05",    address: "La Pineda, Vila-seca",                       lat: 41.0750, lng: 1.1540, icon: "landmark" },
  { label: "Salou",             sublabel: "Costa Dorada · 1h05",    address: "Salou, Vila-seca",                           lat: 41.0765, lng: 1.1426, icon: "landmark" },
  { label: "PortAventura World",sublabel: "Salou · 1h05",           address: "PortAventura World, Salou",                  lat: 41.0864, lng: 1.1546, icon: "landmark" },
  { label: "Cambrils",          sublabel: "Costa Dorada · 1h10",    address: "Cambrils, Baix Camp",                        lat: 41.0652, lng: 1.0594, icon: "landmark" },
  // ── Costa Brava ──────────────────────────────────────────────────────────
  { label: "Mataró",            sublabel: "Costa Brava · 30 min",   address: "Mataro, Maresme",                            lat: 41.5388, lng: 2.4450, icon: "landmark" },
  { label: "Calella",           sublabel: "Costa Brava · 45 min",   address: "Calella, Maresme",                           lat: 41.6175, lng: 2.6575, icon: "landmark" },
  { label: "Pineda de Mar",     sublabel: "Costa Brava · 50 min",   address: "Pineda de Mar, Maresme",                     lat: 41.6249, lng: 2.6835, icon: "landmark" },
  { label: "Santa Susanna",     sublabel: "Costa Brava · 55 min",   address: "Santa Susanna, Maresme",                     lat: 41.6736, lng: 2.7139, icon: "landmark" },
  { label: "Malgrat de Mar",    sublabel: "Costa Brava · 55 min",   address: "Malgrat de Mar, Maresme",                    lat: 41.6475, lng: 2.7477, icon: "landmark" },
  { label: "Blanes",            sublabel: "Costa Brava · 1h",       address: "Blanes, Selva",                              lat: 41.6747, lng: 2.7897, icon: "landmark" },
  { label: "Lloret de Mar",     sublabel: "Costa Brava · 1h",       address: "Lloret de Mar, Selva",                       lat: 41.6993, lng: 2.8469, icon: "landmark" },
  { label: "Tossa de Mar",      sublabel: "Costa Brava · 1h10",     address: "Tossa de Mar, Selva",                        lat: 41.7218, lng: 2.9330, icon: "landmark" },
  { label: "Platja d'Aro",      sublabel: "Costa Brava · 1h20",     address: "Platja d'Aro, Baix Emporda",                 lat: 41.8174, lng: 3.0648, icon: "landmark" },
  { label: "Palamós",           sublabel: "Costa Brava · 1h25",     address: "Palamos, Baix Emporda",                      lat: 41.8449, lng: 3.1304, icon: "landmark" },
  { label: "Roses",             sublabel: "Costa Brava · 1h45",     address: "Roses, Alt Emporda",                         lat: 42.2688, lng: 3.1760, icon: "landmark" },
  { label: "Empuriabrava",      sublabel: "Costa Brava · 1h50",     address: "Empuriabrava, Alt Emporda",                  lat: 42.2494, lng: 3.1166, icon: "landmark" },
  { label: "Figueres",          sublabel: "Costa Brava · 1h45",     address: "Figueres, Alt Emporda",                      lat: 42.2676, lng: 2.9624, icon: "landmark" },
  { label: "Cadaqués",          sublabel: "Costa Brava · 2h",       address: "Cadaques, Alt Emporda",                      lat: 42.2882, lng: 3.2787, icon: "landmark" },
];

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("elite_session_id");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("elite_session_id", sid);
  }
  return sid;
}

const STEPS = [
  { id: 1, label: "Journey" },
  { id: 2, label: "Vehicle" },
  { id: 3, label: "Confirm" },
];

const BOOKING_TYPES: { type: BookingType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "TRANSFER",  label: "Transfer",  icon: MapPin,     desc: "Airport, hotel, point-to-point" },
  { type: "HOURLY",    label: "By Hour",   icon: Timer,      desc: "Chauffeur for 2–12 hours" },
  { type: "DAY_HIRE",  label: "Full Day",  icon: Calendar,   desc: "8-hour full day service" },
  { type: "CORPORATE", label: "Corporate", icon: Building2,  desc: "Business account bookings" },
];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const HOURS_OPTIONS = [4, 5, 6, 8, 10, 12];

function todayStr()    { return new Date().toISOString().split("T")[0]; }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; }

// Converts any vehicle identifier (FleetVehicle or VehicleClass) from URL params
// to the DB-compatible VehicleClass used in data.vehicleClass.
function normalizeVehicleClass(v: string | null): VehicleClass {
  if (!v) return "BUSINESS";
  if (v in FLEET_TO_DB_CLASS) return FLEET_TO_DB_CLASS[v as FleetVehicle];
  return v as VehicleClass;
}

function roundUpToNext30(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 90);
  const m = now.getMinutes() < 30 ? "30" : "00";
  if (now.getMinutes() >= 30) now.setHours(now.getHours() + 1);
  return `${now.getHours().toString().padStart(2, "0")}:${m}`;
}

export default function BookFormClient() {
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
    vehicleClass:    normalizeVehicleClass(params.get("vehicle")),
    guestName:       "",
    guestEmail:      "",
    guestPhone:      "",
    flightNumber:    "",
    specialRequests: "",
    extras:          [],
  });

  const [quote,         setQuote]         = useState<QuoteResponse | null>(null);
  const [loadingQ,      setLoadingQ]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [,              setBookingId]     = useState<string | null>(null);

  const [couponCode,    setCouponCode]    = useState("");
  const [couponInput,   setCouponInput]   = useState("");
  const [couponPct,     setCouponPct]     = useState(0);
  const [couponError,   setCouponError]   = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const sessionId    = useRef<string>("");
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookingType = data.bookingType ?? "TRANSFER";

  useEffect(() => { sessionId.current = getOrCreateSessionId(); }, []);

  const saveSession = useCallback(() => {
    if (!sessionId.current) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(() => {
      fetch("/api/booking-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          email:     data.guestEmail || undefined,
          name:      data.guestName  || undefined,
          phone:     data.guestPhone || undefined,
          formData:  { ...data },
          step,
        }),
      }).catch(() => {});
    }, 1500);
  }, [data, step]);

  useEffect(() => {
    if (step >= 1) saveSession();
  }, [data.guestEmail, data.guestName, data.guestPhone, step, saveSession]);

  const applyCoupon = async () => {
    if (!couponInput || !data.guestEmail) {
      setCouponError(!data.guestEmail ? "Enter your email first" : "Enter a coupon code");
      return;
    }
    setCouponLoading(true);
    setCouponError("");
    try {
      const res  = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, email: data.guestEmail }),
      });
      const json = await res.json();
      if (!json.valid) throw new Error(json.reason ?? "Invalid coupon");
      setCouponCode(couponInput.toUpperCase());
      setCouponPct(json.discountPct);
      toast.success(`${json.discountPct}% discount applied!`);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Invalid coupon");
    } finally {
      setCouponLoading(false);
    }
  };

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
        pickupAddress:  data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
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

  useEffect(() => {
    if (hasPrefilledJourney && data.vehicleClass && data.pickupLat && data.date && data.time) {
      fetchQuote(data.vehicleClass as VehicleClass);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extrasTotal  = (data.extras ?? []).reduce((s, e) => s + e.price * e.quantity, 0);
  const subtotal     = (quote?.totalAmount ?? 0) + extrasTotal;
  const couponSaving = couponPct > 0 ? Math.round((subtotal * couponPct / 100) * 100) / 100 : 0;
  const grandTotal   = Math.round(Math.max(0, subtotal - couponSaving) * 100) / 100;

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

  const quickSelect = (opt: "now1h" | "tomorrowAM" | "tomorrowPM") => {
    if (opt === "now1h")       setData((d) => ({ ...d, date: todayStr(), time: roundUpToNext30() }));
    else if (opt === "tomorrowAM") setData((d) => ({ ...d, date: tomorrowStr(), time: "09:00" }));
    else                       setData((d) => ({ ...d, date: tomorrowStr(), time: "14:00" }));
  };

  const hoursUntilPickup = data.date && data.time
    ? (new Date(`${data.date}T${data.time}`).getTime() - Date.now()) / 3_600_000
    : Infinity;

  const goToStep2 = () => {
    if (hoursUntilPickup < 1) {
      toast.error("Bookings require at least 1 hour notice. For urgent transfers, call +34 635 383 712.");
      return;
    }
    setStep(2);
    if (data.vehicleClass) fetchQuote(data.vehicleClass);
  };

  const step1Valid = !!data.pickupLat && !!data.date && !!data.time && (bookingType !== "TRANSFER" || !!data.dropoffLat);
  const step3Valid = !!data.guestName && !!data.guestEmail && !!data.guestPhone;

  const handlePay = async () => {
    setSubmitting(true);
    try {
      const finalQuote = quote ? { ...quote, totalAmount: grandTotal } : quote;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, quote: finalQuote, couponCode: couponCode || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Booking failed");
      setBookingId(json.bookingId);
      // Store temp credentials in sessionStorage — shown once on success page
      if (json.accountCreated && json.tempPassword) {
        try {
          sessionStorage.setItem("elite_new_account", JSON.stringify({
            email:        json.email,
            tempPassword: json.tempPassword,
            ts:           Date.now(),
          }));
        } catch { /* ignore */ }
      }
      if (sessionId.current) {
        fetch(`/api/booking-session?sessionId=${sessionId.current}`, { method: "DELETE" }).catch(() => {});
      }
      window.location.href = json.checkoutUrl;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505]">
      <div className="container mx-auto px-4 py-10 max-w-3xl pb-28 sm:pb-10">

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button onClick={() => step > s.id && setStep(s.id)} className="flex flex-col items-center gap-1">
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

          {/* STEP 1: Journey */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="glass-card rounded-2xl p-6 sm:p-8">
                <h2 className="font-display text-2xl text-white mb-6">Plan Your Journey</h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                  {BOOKING_TYPES.map(({ type, label, icon: Icon, desc }) => {
                    const sel = bookingType === type;
                    return (
                      <button key={type}
                        onClick={() => setData((d) => ({ ...d, bookingType: type, quote: undefined }))}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200 text-xs",
                          sel ? "border-gold-500/60 bg-gold-500/8 text-gold-400"
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
                  <div>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Pick-up Location</label>
                    <AddressAutocomplete
                      value={data.pickupAddress ?? ""}
                      onChange={(v) => setData((d) => ({ ...d, pickupAddress: v.address, pickupLat: v.lat, pickupLng: v.lng }))}
                      placeholder="Airport, hotel, or type any Barcelona address…"
                      icon={<div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-black" /></div>}
                      quickZones={PICKUP_QUICK_ZONES}
                    />
                  </div>

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

                  {bookingType === "HOURLY" && (
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                        Duration <span className="text-dark-600 normal-case tracking-normal">(minimum 4 hours)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {HOURS_OPTIONS.map((h) => (
                          <button key={h}
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

                  {bookingType === "DAY_HIRE" && (
                    <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-4 text-sm text-dark-300">
                      <p className="text-gold-400 font-medium mb-1">Full Day Hire — 8 Hours</p>
                      <p>Your chauffeur is at your disposal for the full day. Includes up to 200km. Additional km billed at standard rate.</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">Date & Time</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {([
                        ["In 1.5 Hours", "now1h"],
                        ["Tomorrow 9 AM", "tomorrowAM"],
                        ["Tomorrow 2 PM", "tomorrowPM"],
                      ] as const).map(([label, opt]) => (
                        <button key={opt} onClick={() => quickSelect(opt)}
                          className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-dark-400 hover:border-gold-500/30 hover:text-gold-400 transition-all">
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <input type="date" value={data.date ?? ""} min={todayStr()}
                          onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm" />
                      </div>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <select value={data.time ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, time: e.target.value }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
                          <option value="" className="bg-[#111]">Select time…</option>
                          {TIME_SLOTS.map((t) => (
                            <option key={t} value={t} className="bg-[#111]">{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Timing warnings */}
                    {data.date && data.time && hoursUntilPickup < 1 && (
                      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                        <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                        <span>Bookings require at least 1 hour notice. For urgent transfers, call <a href="tel:+34635383712" className="underline font-medium">+34 635 383 712</a>.</span>
                      </div>
                    )}
                    {data.date && data.time && hoursUntilPickup >= 1 && hoursUntilPickup < 4 &&
                      (bookingType === "HOURLY" || bookingType === "DAY_HIRE") && (
                      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
                        <Zap size={13} className="mt-0.5 flex-shrink-0" />
                        <span><strong>Last-minute booking</strong> — a 15% priority dispatch fee will be added to the hourly rate.</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Passengers</label>
                      <div className="relative">
                        <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <select value={data.passengers}
                          onChange={(e) => setData((d) => ({ ...d, passengers: Number(e.target.value) }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
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
                        <select value={data.luggage}
                          onChange={(e) => setData((d) => ({ ...d, luggage: Number(e.target.value) }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
                          {Array.from({ length: 17 }, (_, i) => i).map((n) => (
                            <option key={n} value={n} className="bg-[#111]">{n} bag{n !== 1 ? "s" : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button onClick={goToStep2} disabled={!step1Valid}
                    className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2">
                    Select Vehicle <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Vehicle Selection */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-4">
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

                {VEHICLE_CATALOG
                  .filter((v) => v.maxPassengers >= (data.passengers ?? 1))
                  .map((v) => {
                    const dbClass = FLEET_TO_DB_CLASS[v.class];
                    const sel = data.vehicleClass === dbClass;
                    const isCustomRoute = quote?.isCustomRoute === true;
                    const pricing = quote && sel && !isCustomRoute ? quote : null;
                    const minFare = getFleetFromPrice(v.class);
                    const minHours = MIN_HOURLY_HOURS[dbClass] ?? 4;
                    const selectedHours = bookingType === "DAY_HIRE" ? 8 : Math.max(data.durationHours ?? 4, minHours);
                    const hourlyRate = bookingType === "HOURLY" || bookingType === "DAY_HIRE"
                      ? HOURLY_RATES[dbClass] * selectedHours
                      : null;

                    return (
                      <motion.button key={v.class}
                        onClick={() => { setData((d) => ({ ...d, vehicleClass: dbClass })); fetchQuote(dbClass); }}
                        className={cn(
                          "w-full text-left rounded-xl border overflow-hidden transition-all duration-200",
                          sel ? "border-gold-500/60 bg-gold-500/5 shadow-lg shadow-gold-500/10"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-gold-500/20"
                        )}
                      >
                        <div className="flex">
                          <div className="relative w-28 sm:w-36 flex-shrink-0 aspect-[4/3]"
                            style={{ background: "radial-gradient(ellipse at 60% 40%, #1a1a1a, #0a0a0a)" }}>
                            <Image src={v.image} alt={v.label} fill sizes="144px"
                              className="object-contain p-2"
                              style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.8))" }} />
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
                                {sel && isCustomRoute ? (
                                  <p className="text-amber-400 text-xs font-medium">Custom quote</p>
                                ) : pricing ? (
                                  <>
                                    <p className="font-display text-lg text-gold-400">{formatCurrency(pricing.totalAmount)}</p>
                                    <p className="text-dark-500 text-[10px]">
                                      {pricing.distanceKm > 0 ? `${pricing.distanceKm}km` : `${pricing.hours ?? data.durationHours}h`}
                                    </p>
                                  </>
                                ) : hourlyRate !== null ? (
                                  <>
                                    <p className="font-display text-lg text-gold-400">{formatCurrency(hourlyRate)}</p>
                                    <p className="text-dark-500 text-[10px]">{formatCurrency(HOURLY_RATES[dbClass])}/h · {selectedHours}h</p>
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

                {quote?.isCustomRoute && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-amber-400 font-medium text-sm mb-1">Custom route — fixed price confirmed within 15 minutes.</p>
                    <p className="text-dark-400 text-xs mb-3">This route isn&apos;t in our standard table. Contact us and we&apos;ll provide a fixed price with no surprises.</p>
                    <a
                      href={`https://wa.me/34635383712?text=${encodeURIComponent(`Hi, I need a quote for a transfer from ${data.pickupAddress ?? ""} to ${data.dropoffAddress ?? ""}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      <MessageCircle size={14} /> WhatsApp for quote
                    </a>
                  </div>
                )}

                {quote && !quote.isCustomRoute && quote.fromLabel && (
                  <div className="text-center py-3 border-t border-gold-500/10">
                    <p className="font-display text-xl text-gold-400 tabular-nums">
                      {quote.fromLabel} → {quote.toLabel} · €{quote.totalAmount} fixed · VAT included
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button onClick={() => setStep(3)} disabled={!data.vehicleClass || !!quote?.isCustomRoute}
                    className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Details & Extras */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-6 sm:p-8">
                  <h2 className="font-display text-2xl text-white mb-6">Passenger Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Full Name *</label>
                      <div className="relative">
                        <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <input required type="text" value={data.guestName ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, guestName: e.target.value }))}
                          placeholder="As on travel document"
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email *</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input required type="email" value={data.guestEmail ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, guestEmail: e.target.value }))}
                            placeholder="you@email.com"
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Phone *</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input required type="tel" value={data.guestPhone ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, guestPhone: e.target.value }))}
                            placeholder="+34 6xx xxx xxx"
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>

                    {(bookingType === "TRANSFER" || bookingType === "CORPORATE") && (
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                          Flight Number <span className="text-dark-600">(optional)</span>
                        </label>
                        <div className="relative">
                          <Plane size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input type="text" value={data.flightNumber ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, flightNumber: e.target.value }))}
                            placeholder="e.g. IB3456 or VY1234"
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                        Additional Notes <span className="text-dark-600">(optional)</span>
                      </label>
                      <div className="relative">
                        <MessageSquare size={14} className="absolute left-3.5 top-3.5 text-gold-500/60 pointer-events-none" />
                        <textarea rows={2} value={data.specialRequests ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, specialRequests: e.target.value }))}
                          placeholder="Any specific instructions for your driver…"
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm resize-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-6 sm:p-8">
                  <h2 className="font-display text-xl text-white mb-2">Add Extras</h2>
                  <p className="text-dark-400 text-sm mb-5">Enhance your journey with optional add-ons</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EXTRAS_CATALOG.map((extra) => {
                      const selected = (data.extras ?? []).find((e) => e.id === extra.id);
                      return (
                        <div key={extra.id}
                          className={cn(
                            "rounded-xl border p-4 cursor-pointer transition-all duration-200",
                            selected ? "border-gold-500/50 bg-gold-500/5" : "border-white/[0.06] hover:border-gold-500/20"
                          )}
                          onClick={() => toggleExtra(extra.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <span className="text-xl leading-none mt-0.5">{extra.icon}</span>
                              <div>
                                <p className={cn("text-sm font-medium", selected ? "text-gold-400" : "text-white")}>{extra.label}</p>
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
                          {selected && extra.maxQty > 1 && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]"
                              onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-dark-400">Quantity:</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateExtraQty(extra.id, -1)}
                                  className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-dark-300 hover:border-gold-500/40">
                                  <Minus size={10} />
                                </button>
                                <span className="text-white text-sm w-4 text-center">{selected.quantity}</span>
                                <button onClick={() => updateExtraQty(extra.id, 1)}
                                  disabled={selected.quantity >= extra.maxQty}
                                  className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-dark-300 hover:border-gold-500/40 disabled:opacity-40">
                                  <Plus size={10} />
                                </button>
                              </div>
                              {extra.price > 0 && (
                                <span className="text-gold-400 text-xs ml-auto">{formatCurrency(extra.price * selected.quantity)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Price summary — shown inline once a quote is loaded */}
                {quote && !quote.isCustomRoute && (
                  <div className="glass-card rounded-2xl p-6">
                    <h2 className="font-display text-xl text-white mb-4">Price Summary</h2>
                    {(quote.fromLabel || quote.toLabel) && (
                      <p className="text-xs text-dark-400 mb-3 flex items-center gap-1">
                        <MapPin size={10} className="text-gold-500/50 flex-shrink-0" />
                        {quote.fromLabel} → {quote.toLabel} · Fixed fare
                      </p>
                    )}
                    <div className="bg-black/30 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-dark-400">
                        <span>Transfer price</span><span>{formatCurrency(quote.totalAmount)}</span>
                      </div>
                      {(data.extras ?? []).filter((e) => e.price > 0).map((e) => (
                        <div key={e.id} className="flex justify-between text-dark-400">
                          <span>{e.label} {e.quantity > 1 ? `×${e.quantity}` : ""}</span>
                          <span>{formatCurrency(e.price * e.quantity)}</span>
                        </div>
                      ))}
                      {(quote.lastMinuteSurcharge ?? 0) > 0 && (
                        <div className="flex justify-between text-amber-400">
                          <span className="flex items-center gap-1"><Zap size={11} /> Last-minute fee (+15%)</span>
                          <span>{formatCurrency(quote.lastMinuteSurcharge!)}</span>
                        </div>
                      )}
                      {couponSaving > 0 && (
                        <div className="flex justify-between text-green-400">
                          <span className="flex items-center gap-1.5"><Tag size={11} /> Coupon {couponCode}</span>
                          <span>-{formatCurrency(couponSaving)}</span>
                        </div>
                      )}
                      <div className="border-t border-white/10 pt-3 flex justify-between items-end">
                        <span className="text-white font-semibold">Total</span>
                        <span className="font-display text-xl text-gold-400">{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-dark-500">
                      <span className="flex items-center gap-1"><Shield size={11} className="text-gold-500" /> Free cancellation 24h+</span>
                      <span className="flex items-center gap-1"><CreditCard size={11} className="text-gold-500" /> Secure SumUp payment</span>
                      {hoursUntilPickup < 4 && hoursUntilPickup >= 1 && (
                        <span className="flex items-center gap-1 text-amber-400 font-medium"><Zap size={11} /> 15% last-minute fee applied</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Coupon */}
                {!couponCode ? (
                  <div className="glass-card rounded-xl p-4">
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">Have a coupon code?</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <input type="text" value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                          placeholder="ELITE-XXXXXX"
                          className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm" />
                      </div>
                      <button onClick={applyCoupon} disabled={couponLoading || !data.guestEmail}
                        className="btn-outline-gold px-4 py-3 rounded-xl text-sm whitespace-nowrap disabled:opacity-40">
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
                    {!data.guestEmail && <p className="text-dark-500 text-[11px] mt-1">Enter your email above to apply a coupon</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-green-400" />
                      <span className="text-sm text-white font-medium">{couponCode}</span>
                      <span className="text-sm text-green-400">{couponPct}% OFF applied</span>
                    </div>
                    <button onClick={() => { setCouponCode(""); setCouponPct(0); setCouponInput(""); }} className="text-dark-400 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                    <ArrowLeft size={16} /> Back
                  </button>
                  {quote?.isCustomRoute ? (
                    <a
                      href={`https://wa.me/34635383712?text=${encodeURIComponent(`Hi, I need a quote for a transfer from ${data.pickupAddress ?? ""} to ${data.dropoffAddress ?? ""}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={16} /> WhatsApp for quote
                    </a>
                  ) : (
                    <button onClick={handlePay} disabled={!step3Valid || submitting}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {submitting ? "Processing…" : quote ? `Pay ${formatCurrency(grandTotal)}` : "Confirm Booking"}
                    </button>
                  )}
                </div>

                <p className="text-center text-xs text-dark-500 pb-4">
                  Secured by SumUp · PCI DSS Level 1 · Apple Pay & Google Pay accepted
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Mobile sticky price bar — visible on steps 2–4 when vehicle + quote ready */}
      {step >= 2 && data.vehicleClass && grandTotal > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d]/95 backdrop-blur border-t border-gold-500/20 px-4 py-3 flex items-center gap-3 safe-area-pb">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-dark-400 truncate">
              {VEHICLE_CATALOG.find((v) => FLEET_TO_DB_CLASS[v.class] === data.vehicleClass)?.label}
            </p>
            <p className="font-display text-lg text-gold-400 leading-tight">{formatCurrency(grandTotal)}</p>
          </div>
          {step === 2 && (
            <button onClick={() => setStep(3)} disabled={!data.vehicleClass}
              className="btn-gold px-5 py-3 rounded-xl text-sm font-semibold flex-shrink-0">
              Continue
            </button>
          )}
          {step === 3 && (
            <button onClick={handlePay} disabled={!step3Valid || submitting}
              className="btn-gold px-5 py-3 rounded-xl text-sm font-semibold flex-shrink-0 flex items-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "…" : `Pay ${formatCurrency(grandTotal)}`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
