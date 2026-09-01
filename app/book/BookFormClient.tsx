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
  VEHICLE_CATALOG, EXTRAS_CATALOG, BOOKING_TYPE_LABELS, FLEET_TO_DB_CLASS, vehicleBadgeClass,
  type FleetVehicle, type VehicleClass, type BookingFormData, type QuoteResponse,
  type BookingType,
} from "@/types";
import { getFleetFromPrice, HOURLY_RATES, MIN_HOURLY_HOURS } from "@/lib/pricing";
import { VAT_RATE, vatOn, wantsInvoice } from "@/lib/vat";
import { TIP_PRESETS, tipForPercent, clampTip, MAX_TIP_ABSOLUTE } from "@/lib/tips";
import toast from "react-hot-toast";
import { useTranslations } from "@/components/language/I18nProvider";
import { pickupToUtc } from "@/lib/datetime";
import PhoneField from "@/components/booking/PhoneField";
import { isUsablePhone, splitE164 } from "@/lib/dial-codes";

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
  { id: 2, label: "Your details" },
  { id: 3, label: "Vehicle & price" },
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

/**
 * The exact car from a ?vehicle= parameter.
 *
 * Tracked alongside the class because the class alone cannot identify the car:
 * the Camry and the E-Class are both Business, and they are priced apart. A
 * parameter naming only a class leaves this undefined, which prices at the
 * class exactly as before.
 */
function normalizeFleetVehicle(v: string | null): FleetVehicle | undefined {
  return v && v in FLEET_TO_DB_CLASS ? (v as FleetVehicle) : undefined;
}

function roundUpToNext30(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 90);
  const m = now.getMinutes() < 30 ? "30" : "00";
  if (now.getMinutes() >= 30) now.setHours(now.getHours() + 1);
  return `${now.getHours().toString().padStart(2, "0")}:${m}`;
}

export default function BookFormClient() {
  const t = useTranslations("bookflow");
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
    fleetVehicle:    normalizeFleetVehicle(params.get("vehicle")),
    guestName:       "",
    guestEmail:      "",
    guestPhone:      "",
    flightNumber:    "",
    specialRequests: "",
    extras:          [],
  });

  const [quote,         setQuote]         = useState<QuoteResponse | null>(null);

  // A route outside the fixed table is now priced per kilometre and is fully
  // bookable. This flag means only one thing: we could not produce a price at
  // all (no drop-off coordinates, so no distance), and a human must quote it.
  const needsManualQuote = quote != null && (quote.needsManualQuote === true || quote.totalAmount <= 0);
  const [loadingQ,      setLoadingQ]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [,              setBookingId]     = useState<string | null>(null);

  const [couponCode,    setCouponCode]    = useState("");
  const [couponInput,   setCouponInput]   = useState("");
  const [couponPct,     setCouponPct]     = useState(0);
  const [couponError,   setCouponError]   = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // A preset percentage, or null while a custom amount is being typed. Starts
  // at 0 so nobody is tipped by default — an opt-out tip is a dark pattern.
  const [tipPct,        setTipPct]        = useState<number | null>(0);
  const [tipCustom,     setTipCustom]     = useState("");

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

  // Only record a session once the visitor has actually entered something.
  //
  // This fired on mount, so every page load wrote a row before anyone had
  // touched the form: 264 of 296 step-one sessions held no data at all and a
  // median time of zero seconds. That made the funnel count page loads rather
  // than intent, and buried the 32 people who really did start filling it in.
  const hasStarted =
    !!data.pickupAddress || !!data.dropoffAddress || !!data.date || !!data.time ||
    !!data.guestEmail || !!data.guestName || !!data.guestPhone || step > 1;

  useEffect(() => {
    if (hasStarted) saveSession();
  }, [hasStarted, data.guestEmail, data.guestName, data.guestPhone, step, saveSession]);

  const applyCoupon = async () => {
    if (!couponInput || !data.guestEmail) {
      setCouponError(!data.guestEmail ? t("enterEmailFirst") : t("enterCoupon"));
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
      if (!json.valid) throw new Error(json.reason ?? t("invalidCoupon"));
      setCouponCode(couponInput.toUpperCase());
      setCouponPct(json.discountPct);
      toast.success(`${json.discountPct}% discount applied!`);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : "Invalid coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const fetchQuote = useCallback(async (vehicleClass: VehicleClass, bType?: BookingType, fleetVehicle?: FleetVehicle) => {
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
        fleetVehicle,
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
      fetchQuote(data.vehicleClass as VehicleClass, undefined, data.fleetVehicle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extrasTotal  = (data.extras ?? []).reduce((s, e) => s + e.price * e.quantity, 0);
  const subtotal     = (quote?.totalAmount ?? 0) + extrasTotal;
  const couponSaving = couponPct > 0 ? Math.round((subtotal * couponPct / 100) * 100) / 100 : 0;
  // Fares are quoted excluding VAT. The 10% is only charged to customers who
  // ask for an invoice, and it goes on the discounted figure — VAT is due on
  // what is actually paid, not on the list price before a coupon.
  const netTotal     = Math.round(Math.max(0, subtotal - couponSaving) * 100) / 100;
  const invoiceAsked = wantsInvoice(data.extras);
  const vatAmount    = invoiceAsked ? vatOn(netTotal) : 0;

  // The tip is a percentage of the fare, never of the fare plus its VAT, and it
  // is added after both — it is not taxable and not discountable. See lib/tips.
  const tipAmount = tipPct !== null
    ? tipForPercent(netTotal, tipPct)
    : clampTip(tipCustom.replace(",", "."), netTotal);

  const grandTotal   = Math.round((netTotal + vatAmount + tipAmount) * 100) / 100;

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
    ? ((pickupToUtc(data.date, data.time)?.getTime() ?? NaN) - Date.now()) / 3_600_000
    : Infinity;

  const goToStep2 = () => {
    if (hoursUntilPickup < 1) {
      toast.error("Bookings require at least 1 hour notice. For urgent transfers, call +34 635 383 712.");
      return;
    }
    setStep(2);
  };

  // Entering the vehicle step quotes immediately, so a price is on screen
  // without the customer having to pick a car first.
  const goToStep3 = () => {
    setStep(3);
    if (data.vehicleClass) fetchQuote(data.vehicleClass, undefined, data.fleetVehicle);
  };

  const step1Valid = !!data.pickupLat && !!data.date && !!data.time && (bookingType !== "TRANSFER" || !!data.dropoffLat);
  // Named for what it checks rather than which step it sits on, since the
  // contact fields have now moved a step earlier.
  // A phone number is only useful if someone can dial it. This read
  // `!!data.guestPhone`, so one stray digit was enough to book a transfer —
  // and the driver found that out at arrivals.
  const phoneParts = splitE164(data.guestPhone ?? "");
  const phoneValid = isUsablePhone(phoneParts.iso, phoneParts.national);
  const contactValid = !!data.guestName && !!data.guestEmail && phoneValid;

  const handlePay = async () => {
    setSubmitting(true);
    try {
      const finalQuote = quote ? { ...quote, totalAmount: grandTotal } : quote;
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          quote: finalQuote,
          couponCode: couponCode || undefined,
          tipAmount,
        }),
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
      toast.error(err instanceof Error ? err.message : t("bookingFailed"));
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
                <h2 className="font-display text-2xl text-white mb-6">{t("step1")}</h2>

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
                      placeholder={t("pickupPlaceholder")}
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
                        placeholder={t("dropoffPlaceholder")}
                      />
                    </div>
                  )}

                  {bookingType === "HOURLY" && (
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                        Duration <span className="text-dark-500 normal-case tracking-normal">(minimum 4 hours)</span>
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
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">{t("dateTime")}</label>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none z-10" />
                        <input type="date" aria-label="Date" value={data.date ?? ""} min={todayStr()}
                          onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm [color-scheme:dark]" />
                      </div>
                      <div className="relative">
                        <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none z-10" />
                        <select aria-label="Time" value={data.time ?? ""}
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
                      <label htmlFor="book-passengers" className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">{t("passengers")}</label>
                      <div className="relative">
                        <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <select id="book-passengers" value={data.passengers}
                          onChange={(e) => setData((d) => ({ ...d, passengers: Number(e.target.value) }))}
                          className="input-luxury w-full pl-9 pr-3 py-4 rounded-xl text-sm appearance-none">
                          {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n} className="bg-[#111]">{n} passenger{n > 1 ? "s" : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="book-luggage" className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">{t("luggage")}</label>
                      <div className="relative">
                        <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <select id="book-luggage" value={data.luggage}
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
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3a: Vehicle selection and price. Renders above the extras
              block below, which is also step 3. */}
          {step === 3 && (
            <motion.div key="s3a" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                    // A per-km route now has a real price, so it renders like any
                    // other. Only a journey we genuinely could not price falls back
                    // to the contact-us treatment.
                    const pricing = quote && sel && !needsManualQuote ? quote : null;
                    const minFare = getFleetFromPrice(v.class);
                    const minHours = MIN_HOURLY_HOURS[dbClass] ?? 4;
                    const selectedHours = bookingType === "DAY_HIRE" ? 8 : Math.max(data.durationHours ?? 4, minHours);
                    const hourlyRate = bookingType === "HOURLY" || bookingType === "DAY_HIRE"
                      ? HOURLY_RATES[dbClass] * selectedHours
                      : null;

                    return (
                      <motion.button key={v.class}
                        onClick={() => { setData((d) => ({ ...d, vehicleClass: dbClass, fleetVehicle: v.class })); fetchQuote(dbClass, undefined, v.class); }}
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${vehicleBadgeClass(v.badge)}`}>{v.badge}</span>
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
                                {sel && needsManualQuote ? (
                                  <p className="text-amber-400 text-xs font-medium">{t("customQuote")}</p>
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

                {needsManualQuote && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-amber-400 font-medium text-sm mb-1">We couldn&apos;t calculate a price for this journey.</p>
                    <p className="text-dark-400 text-xs mb-3">Please check the pickup and drop-off addresses, or message us and we&apos;ll quote you a fixed price by hand.</p>
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

                {quote && !needsManualQuote && quote.totalAmount > 0 && (
                  <div className="text-center py-3 border-t border-gold-500/10">
                    <p className="font-display text-xl text-gold-400 tabular-nums">
                      {quote.fromLabel
                        ? `${quote.fromLabel} → ${quote.toLabel} · €${quote.totalAmount} fixed`
                        : `€${quote.totalAmount} · ${quote.distanceKm} km`}
                    </p>
                    <p className="text-dark-400 text-xs mt-1">
                      {quote.isCustomRoute
                        ? "Distance-based fixed price for this journey · excl. VAT & tolls"
                        : "excl. VAT & tolls · 10% VAT added only if you need an invoice"}
                    </p>
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {/* STEP 2: Your details — moved ahead of the price on the owner's
              instruction, so a booking that is abandoned still carries a name
              and an email to follow up on. */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-6 sm:p-8">
                  <h2 className="font-display text-2xl text-white mb-6">{t("step3")}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Full Name *</label>
                      <div className="relative">
                        <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <input required type="text" value={data.guestName ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, guestName: e.target.value }))}
                          placeholder={t("namePlaceholder")}
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
                            placeholder={t("emailPlaceholder")}
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                      {/* Country code is not optional here. A number with no
                          country is not a number the dispatcher can ring. */}
                      <PhoneField
                        value={data.guestPhone ?? ""}
                        onChange={(e164) => setData((d) => ({ ...d, guestPhone: e164 }))}
                        placeholder={t("phonePlaceholder")}
                      />
                    </div>

                    {(bookingType === "TRANSFER" || bookingType === "CORPORATE") && (
                      <div>
                        <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                          Flight Number <span className="text-dark-500">(optional)</span>
                        </label>
                        <div className="relative">
                          <Plane size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                          <input type="text" value={data.flightNumber ?? ""}
                            onChange={(e) => setData((d) => ({ ...d, flightNumber: e.target.value }))}
                            placeholder={t("flightPlaceholder")}
                            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                        Additional Notes <span className="text-dark-500">(optional)</span>
                      </label>
                      <div className="relative">
                        <MessageSquare size={14} className="absolute left-3.5 top-3.5 text-gold-500/60 pointer-events-none" />
                        <textarea rows={2} value={data.specialRequests ?? ""}
                          onChange={(e) => setData((d) => ({ ...d, specialRequests: e.target.value }))}
                          placeholder={t("notesPlaceholder")}
                          className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm resize-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Why the details are asked for before the price is shown.
                    Saying so plainly is both fairer and the lawful basis for
                    using the address if the booking is not completed. */}
                <div className="glass-card rounded-2xl p-5">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.contactConsent ?? false}
                      onChange={(e) => setData((d) => ({ ...d, contactConsent: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 accent-[#c9a84c] flex-shrink-0"
                    />
                    <span className="text-dark-300 text-xs leading-relaxed">
                      Send me this quote and hold my booking details. If I do not finish
                      booking, Elite BCN may contact me once about this journey. No
                      marketing, and you can ask us to delete your details at any time.
                    </span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-outline-gold flex items-center gap-2 px-5 py-4 rounded-xl text-sm">
                    <ArrowLeft size={16} /> Back
                  </button>
                  <button onClick={goToStep3} disabled={!contactValid}
                    className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    See vehicles &amp; price <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3b: Extras, summary and payment — below the vehicle block. */}
          {step === 3 && (
            <motion.div key="s3b" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-6 sm:p-8">
                  <h2 className="font-display text-xl text-white mb-2">{t("addExtras")}</h2>
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
                              <span className="text-xs text-dark-400">{t("quantity")}</span>
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

                {/* Driver gratuity — optional, never preselected. */}
                {quote && !needsManualQuote && netTotal > 0 && (
                  <div className="glass-card rounded-2xl p-6 sm:p-8">
                    <h2 className="font-display text-xl text-white mb-2">Tip your chauffeur</h2>
                    <p className="text-dark-400 text-sm mb-5">
                      Optional, and it goes to your driver in full. You can also tip in the car.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TIP_PRESETS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => { setTipPct(pct); setTipCustom(""); }}
                          aria-pressed={tipPct === pct}
                          className={cn(
                            "px-4 py-2.5 rounded-xl border text-sm transition-all",
                            tipPct === pct
                              ? "border-gold-500/50 bg-gold-500/10 text-gold-400"
                              : "border-white/[0.08] text-dark-300 hover:border-gold-500/25",
                          )}
                        >
                          {pct === 0 ? "No tip" : `${pct}%`}
                          {pct > 0 && (
                            <span className="block text-[11px] text-dark-500 mt-0.5">
                              {formatCurrency(tipForPercent(netTotal, pct))}
                            </span>
                          )}
                        </button>
                      ))}
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-3 rounded-xl border transition-all",
                          tipPct === null
                            ? "border-gold-500/50 bg-gold-500/10"
                            : "border-white/[0.08]",
                        )}
                      >
                        <span className="text-dark-400 text-sm">€</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={tipCustom}
                          placeholder="Other"
                          aria-label="Custom tip amount in euros"
                          onFocus={() => setTipPct(null)}
                          onChange={(e) => {
                            // Digits and one separator only, so the field cannot
                            // hold something clampTip would silently read as 0.
                            const v = e.target.value.replace(/[^\d.,]/g, "");
                            setTipCustom(v);
                            setTipPct(null);
                          }}
                          className="w-20 bg-transparent py-2.5 text-sm text-white placeholder:text-dark-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    {tipPct === null && tipCustom !== "" && tipAmount === 0 && (
                      <p className="text-dark-500 text-xs mt-3">
                        Enter an amount between €1 and €{MAX_TIP_ABSOLUTE} to add a tip.
                      </p>
                    )}
                  </div>
                )}

                {/* Price summary — shown inline once a quote is loaded */}
                {quote && !needsManualQuote && (
                  <div className="glass-card rounded-2xl p-6">
                    <h2 className="font-display text-xl text-white mb-4">{t("priceSummary")}</h2>
                    {(quote.fromLabel || quote.toLabel) && (
                      <p className="text-xs text-dark-400 mb-3 flex items-center gap-1">
                        <MapPin size={10} className="text-gold-500/50 flex-shrink-0" />
                        {quote.fromLabel
                          ? `${quote.fromLabel} → ${quote.toLabel} · Fixed fare`
                          : `${quote.distanceKm} km · distance-based fixed fare`}
                      </p>
                    )}
                    <div className="bg-black/30 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-dark-400">
                        <span>{t("transferPrice")}</span><span>{formatCurrency(quote.totalAmount)}</span>
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
                      {vatAmount > 0 && (
                        <>
                          <div className="flex justify-between text-dark-400 border-t border-white/10 pt-2">
                            <span>Subtotal excl. VAT</span>
                            <span>{formatCurrency(netTotal)}</span>
                          </div>
                          <div className="flex justify-between text-dark-400">
                            <span>VAT ({VAT_RATE}%)</span>
                            <span>{formatCurrency(vatAmount)}</span>
                          </div>
                        </>
                      )}
                      {tipAmount > 0 && (
                        <div className="flex justify-between text-dark-400">
                          <span>Driver tip{tipPct ? ` (${tipPct}%)` : ""}</span>
                          <span>{formatCurrency(tipAmount)}</span>
                        </div>
                      )}
                      <div className="border-t border-white/10 pt-3 flex justify-between items-end">
                        <span className="text-white font-semibold">{t("total")}</span>
                        <span className="font-display text-xl text-gold-400">{formatCurrency(grandTotal)}</span>
                      </div>
                      {vatAmount === 0 && (
                        <p className="text-dark-500 text-xs pt-1">
                          Excludes VAT. Tick &ldquo;I need an invoice&rdquo; above to add {VAT_RATE}% VAT and receive a
                          full Spanish invoice.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-dark-500">
                      <span className="flex items-center gap-1"><Shield size={11} className="text-gold-500" /> Free cancellation 24h+</span>
                      <span className="flex items-center gap-1"><CreditCard size={11} className="text-gold-500" /> {t("securePayment")}</span>
                      {hoursUntilPickup < 4 && hoursUntilPickup >= 1 && (
                        <span className="flex items-center gap-1 text-amber-400 font-medium"><Zap size={11} /> 15% last-minute fee applied</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Coupon */}
                {!couponCode ? (
                  <div className="glass-card rounded-xl p-4">
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-2">{t("haveCoupon")}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
                        <input type="text" value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                          placeholder={t("couponPlaceholder")}
                          className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm" />
                      </div>
                      <button onClick={applyCoupon} disabled={couponLoading || !data.guestEmail}
                        className="btn-outline-gold px-4 py-3 rounded-xl text-sm whitespace-nowrap disabled:opacity-40">
                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : t("apply")}
                      </button>
                    </div>
                    {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
                    {!data.guestEmail && <p className="text-dark-500 text-[11px] mt-1">{t("enterEmailFirst")}</p>}
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
                  {needsManualQuote ? (
                    <a
                      href={`https://wa.me/34635383712?text=${encodeURIComponent(`Hi, I need a quote for a transfer from ${data.pickupAddress ?? ""} to ${data.dropoffAddress ?? ""}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={16} /> WhatsApp for quote
                    </a>
                  ) : (
                    <button onClick={handlePay} disabled={!contactValid || submitting}
                      className="btn-gold flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {submitting ? t("processing") : quote ? `${t("pay")} ${formatCurrency(grandTotal)}` : t("confirmBooking")}
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

      {/* Mobile sticky price bar. Step 3 only: there is no price before it. */}
      {step === 3 && data.vehicleClass && grandTotal > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d]/95 backdrop-blur border-t border-gold-500/20 px-4 py-3 flex items-center gap-3 safe-area-pb">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-dark-400 truncate">
              {VEHICLE_CATALOG.find((v) => FLEET_TO_DB_CLASS[v.class] === data.vehicleClass)?.label}
            </p>
            <p className="font-display text-lg text-gold-400 leading-tight">{formatCurrency(grandTotal)}</p>
          </div>
          {step === 3 && (
            <button onClick={handlePay} disabled={!contactValid || submitting}
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
