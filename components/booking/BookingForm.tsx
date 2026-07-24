"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, Users, Zap, ArrowRight,
  Loader2, MessageCircle, MapPin, RotateCcw, Timer,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { VEHICLE_CATALOG, FLEET_TO_DB_CLASS, type FleetVehicle, type QuoteResponse } from "@/types";
import AddressAutocomplete, { type QuickZone } from "./AddressAutocomplete";

/* ── Pickup quick-select zones ─────────────────────────────────────────────── */
const PICKUP_QUICK_ZONES: QuickZone[] = [
  { label: "Aeropuerto El Prat — T1", sublabel: "Terminal 1 · El Prat de Llobregat", address: "Terminal 1, Barcelona El Prat Airport, El Prat de Llobregat", lat: 41.2971, lng: 2.0785, icon: "airport" },
  { label: "Aeropuerto El Prat — T2", sublabel: "Terminal 2 · El Prat de Llobregat", address: "Terminal 2, Barcelona El Prat Airport, El Prat de Llobregat", lat: 41.2894, lng: 2.0718, icon: "airport" },
  { label: "Barcelona Ciudad",         sublabel: "Passeig de Gràcia · Eixample",      address: "Passeig de Gràcia, Barcelona, Catalonia, Spain",                lat: 41.3916, lng: 2.1649, icon: "city" },
  { label: "Puerto Cruceros BCN",      sublabel: "Moll Adossat · Port de Barcelona",  address: "Moll Adossat, Port de Barcelona, Barcelona",                    lat: 41.3611, lng: 2.1761, icon: "port" },
  { label: "Estación de Sants",        sublabel: "AVE · Trenes larga distancia",      address: "Estació de Sants, Barcelona, Catalonia, Spain",                 lat: 41.3794, lng: 2.1401, icon: "train" },
  { label: "Aeropuerto Girona",        sublabel: "Costa Brava Airport (GRO)",         address: "Girona Costa Brava Airport, Vilobí d'Onyar, Girona",            lat: 41.9011, lng: 2.7604, icon: "airport" },
  { label: "Andorra La Vella",         sublabel: "Principado de Andorra",             address: "Andorra la Vella, Andorra",                                     lat: 42.5063, lng: 1.5218, icon: "landmark" },
  { label: "Tarragona",                sublabel: "Costa Dorada · 1h de BCN",          address: "Tarragona, Catalonia, Spain",                                   lat: 41.1189, lng: 1.2445, icon: "landmark" },
  { label: "Sitges",                   sublabel: "Costa Dorada · 35 min de BCN",      address: "Sitges, Barcelona, Catalonia, Spain",                           lat: 41.2369, lng: 1.8109, icon: "landmark" },
  { label: "PortAventura World",       sublabel: "Salou, Tarragona",                  address: "PortAventura World, Salou, Tarragona, Spain",                   lat: 41.0864, lng: 1.1546, icon: "landmark" },
  { label: "Lloret de Mar",            sublabel: "Costa Brava · 1h de BCN",           address: "Lloret de Mar, Girona, Catalonia, Spain",                      lat: 41.6993, lng: 2.8469, icon: "landmark" },
  { label: "Montserrat",               sublabel: "Monasterio · 1h de BCN",            address: "Montserrat Monastery, Monistrol de Montserrat, Barcelona",      lat: 41.5928, lng: 1.8363, icon: "landmark" },
];

type TripType = "oneway" | "return" | "hourly";

const TRIP_TABS: { type: TripType; label: string; icon: React.ElementType }[] = [
  { type: "oneway",  label: "One Way",    icon: ArrowRight },
  { type: "return",  label: "Return",     icon: RotateCcw },
  { type: "hourly",  label: "By the Hour",icon: Timer },
];

const HOURS_OPTIONS = [2, 3, 4, 5, 6, 8];

function todayStr() { return new Date().toISOString().split("T")[0]; }
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

interface Props { compact?: boolean }

export default function BookingForm({ compact = false }: Props) {
  const router = useRouter();

  const [tripType, setTripType] = useState<TripType>("oneway");
  const [pickup,   setPickup]   = useState({ address: "", lat: 0, lng: 0 });
  const [dropoff,  setDropoff]  = useState({ address: "", lat: 0, lng: 0 });
  const [date,     setDate]     = useState("");
  const [time,     setTime]     = useState("");
  const [pax,      setPax]      = useState(2);
  const [hours,    setHours]    = useState(4);
  const [vehicle,  setVehicle]  = useState<FleetVehicle>("EQE_300");
  const [quote,    setQuote]    = useState<QuoteResponse | null>(null);
  const [loading,  setLoading]  = useState(false);

  const isHourly = tripType === "hourly";

  const fetchQuote = useCallback(async () => {
    if (!pickup.lat || !date || !time) return;
    if (!isHourly && !dropoff.lat) return;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        bookingType:    isHourly ? "HOURLY" : "TRANSFER",
        pickupLat:      pickup.lat,
        pickupLng:      pickup.lng,
        vehicleClass:   FLEET_TO_DB_CLASS[vehicle],
        pickupDatetime: `${date}T${time}`,
        passengers:     pax,
        pickupAddress:  pickup.address,
        dropoffAddress: dropoff.address,
      };
      if (!isHourly) { body.dropoffLat = dropoff.lat; body.dropoffLng = dropoff.lng; }
      if (isHourly)  { body.durationHours = hours; }
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setQuote(await res.json());
    } finally {
      setLoading(false);
    }
  }, [pickup, dropoff, date, time, vehicle, pax, hours, isHourly]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  // Reset quote when trip type changes
  useEffect(() => { setQuote(null); }, [tripType]);

  const handleContinue = () => {
    if (!pickup.address || !date || !time) return;
    if (!isHourly && !dropoff.address) return;
    const params = new URLSearchParams({
      pickup:      pickup.address,
      pLat:        String(pickup.lat),
      pLng:        String(pickup.lng),
      date,
      time,
      pax:         String(pax),
      vehicle:     FLEET_TO_DB_CLASS[vehicle],
      bookingType: isHourly ? "HOURLY" : "TRANSFER",
    });
    if (!isHourly) {
      params.set("dropoff", dropoff.address);
      params.set("dLat",    String(dropoff.lat));
      params.set("dLng",    String(dropoff.lng));
    } else {
      params.set("hours", String(hours));
    }
    router.push(`/book?${params}`);
  };

  const isCustomRoute  = quote?.isCustomRoute === true;
  const canContinue    = !!pickup.address && !!date && !!time && (isHourly || !!dropoff.address);

  return (
    <div className={cn(
      "rounded-2xl overflow-hidden border border-white/[0.07]",
      compact ? "" : ""
    )}>

      {/* ── Gold header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#c9a84c] via-[#b8913d] to-[#a07828] px-6 pt-5 pb-4">
        <p className="text-black/50 text-[10px] font-semibold uppercase tracking-[0.2em] mb-1">Reservation</p>
        <h3 className="font-display text-xl text-black leading-tight">Plan your transfer</h3>
        <p className="text-black/40 text-xs mt-0.5">Instant quote · Fixed pricing · 24/7</p>

        {/* Trip type tabs */}
        <div className="flex gap-1.5 mt-4">
          {TRIP_TABS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setTripType(type)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                tripType === type
                  ? "bg-black text-[#c9a84c] shadow-md"
                  : "bg-black/20 text-black/60 hover:bg-black/30 hover:text-black/80"
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Form body ───────────────────────────────────────────────────────── */}
      <div className="bg-[#0c0c0c] px-6 py-5 space-y-4">

        {/* Where label */}
        <p className="text-white/50 text-xs font-medium tracking-wide">Where would you like to go?</p>

        {/* Pickup */}
        <div>
          <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Pickup</label>
          <AddressAutocomplete
            value={pickup.address}
            onChange={setPickup}
            placeholder="Pick a zone, type an address, or hotel…"
            icon={<div className="w-4 h-4 rounded-full bg-[#c9a84c] flex items-center justify-center flex-shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-black" /></div>}
            quickZones={PICKUP_QUICK_ZONES}
          />
        </div>

        {/* Vertical connector */}
        {!isHourly && (
          <div className="flex items-center gap-3 px-2 -my-1">
            <div className="w-px h-5 bg-[#c9a84c]/15 ml-2" />
          </div>
        )}

        {/* Drop-off (hidden for hourly) */}
        <AnimatePresence>
          {!isHourly && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Drop-off</label>
              <AddressAutocomplete
                value={dropoff.address}
                onChange={setDropoff}
                placeholder="Pick a zone or type a destination"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hours selector (hourly only) */}
        <AnimatePresence>
          {isHourly && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-2">Duration</label>
              <div className="flex flex-wrap gap-2">
                {HOURS_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg border text-sm font-medium transition-all",
                      hours === h
                        ? "border-[#c9a84c] bg-[#c9a84c]/10 text-[#c9a84c]"
                        : "border-white/10 text-white/40 hover:border-[#c9a84c]/30 hover:text-white/70"
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Date</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none" />
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Time</label>
            <div className="relative">
              <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none" />
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm appearance-none"
              >
                <option value="" className="bg-[#111]">HH : MM</option>
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t} className="bg-[#111]">{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Passengers + Vehicle */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Passengers</label>
            <div className="relative">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none" />
              <select
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm appearance-none"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-[#111]">{n} pax</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Vehicle</label>
            <div className="relative">
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value as FleetVehicle)}
                className="input-luxury w-full px-3 py-3 rounded-xl text-sm appearance-none"
              >
                {VEHICLE_CATALOG
                  .filter((v) => v.maxPassengers >= pax)
                  .map((v) => (
                    <option key={v.class} value={v.class} className="bg-[#111]">
                      {v.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quote result */}
        <AnimatePresence>
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-2 text-xs text-white/30">
              <Loader2 size={13} className="animate-spin text-[#c9a84c]" />
              Getting your price…
            </motion.div>
          )}

          {!loading && quote && !isCustomRoute && (
            <motion.div key="quote"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#c9a84c]/5 border border-[#c9a84c]/20">
                <div className="flex items-center gap-2">
                  <Zap size={13} className="text-[#c9a84c]" />
                  <div>
                    <p className="text-[10px] text-[#c9a84c]/60 uppercase tracking-wide font-semibold">Fixed Price</p>
                    {quote.fromLabel && (
                      <p className="text-[11px] text-white/30 flex items-center gap-1 mt-0.5">
                        <MapPin size={9} className="text-[#c9a84c]/40" />
                        {quote.fromLabel} → {quote.toLabel}
                      </p>
                    )}
                  </div>
                </div>
                <p className="font-display text-2xl text-[#c9a84c]">{formatCurrency(quote.totalAmount)}</p>
              </div>
            </motion.div>
          )}

          {!loading && isCustomRoute && (
            <motion.div key="custom"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}>
              <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-amber-400 text-xs font-medium">Custom route — we&apos;ll confirm price in 15 min</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        {isCustomRoute ? (
          <a
            href="https://wa.me/34635383712"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle size={15} /> WhatsApp for a Quote
          </a>
        ) : (
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {quote ? `Book — ${formatCurrency(quote.totalAmount)}` : "Continue"}
            <ArrowRight size={15} />
          </button>
        )}

        {/* Footer trust bar */}
        <div className="flex items-center justify-center gap-4 pt-1">
          {["Mercedes-Benz Fleet", "24/7 Availability", "English & Español"].map((t) => (
            <span key={t} className="text-[10px] text-white/20 uppercase tracking-wider">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
