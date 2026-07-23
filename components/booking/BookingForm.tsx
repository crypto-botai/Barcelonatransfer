"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Users, Zap, ArrowRight, Loader2, ChevronDown, MessageCircle, MapPin } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { VEHICLE_CATALOG, type VehicleClass, type QuoteResponse } from "@/types";
import AddressAutocomplete from "./AddressAutocomplete";

interface Props {
  compact?: boolean;
}

export default function BookingForm({ compact = false }: Props) {
  const router = useRouter();

  const [pickup,  setPickup]  = useState({ address: "", lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState({ address: "", lat: 0, lng: 0 });
  const [date,    setDate]    = useState("");
  const [time,    setTime]    = useState("");
  const [pax,     setPax]     = useState(2);
  const [vehicle, setVehicle] = useState<VehicleClass>("LUXURY");
  const [quote,   setQuote]   = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchQuote = useCallback(async () => {
    if (!pickup.lat || !dropoff.lat || !date || !time) return;
    setLoading(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
          vehicleClass: vehicle,
          pickupDatetime: `${date}T${time}`,
          passengers: pax,
          pickupAddress: pickup.address,
          dropoffAddress: dropoff.address,
        }),
      });
      if (res.ok) setQuote(await res.json());
    } finally {
      setLoading(false);
    }
  }, [pickup, dropoff, date, time, vehicle, pax]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const handleBook = () => {
    if (!pickup.address || !dropoff.address || !date || !time) return;
    const params = new URLSearchParams({
      pickup: pickup.address, pLat: String(pickup.lat), pLng: String(pickup.lng),
      dropoff: dropoff.address, dLat: String(dropoff.lat), dLng: String(dropoff.lng),
      date, time, pax: String(pax), vehicle,
    });
    router.push(`/book?${params}`);
  };

  const isCustomRoute = quote?.isCustomRoute === true;

  return (
    <div className={cn("glass-card rounded-2xl overflow-hidden", compact ? "p-6" : "p-8")}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-xl text-white">Get Instant Quote</h3>
          <p className="text-dark-400 text-xs mt-1 tracking-wide">No hidden fees · Fixed prices</p>
        </div>
        {loading && <Loader2 size={18} className="text-gold-500 animate-spin" />}
      </div>

      <div className="space-y-3">
        <AddressAutocomplete
          value={pickup.address}
          onChange={setPickup}
          placeholder="Pick-up location, airport, hotel…"
          icon={<div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-black" /></div>}
        />

        <div className="flex items-center gap-2 px-3">
          <div className="w-px h-4 bg-gold-500/20 ml-2" />
        </div>

        <AddressAutocomplete
          value={dropoff.address}
          onChange={setDropoff}
          placeholder="Drop-off destination…"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
            <input type="date" value={date} min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              className="input-luxury w-full pl-8 pr-2 py-3.5 rounded-xl text-sm" />
          </div>
          <div className="relative">
            <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="input-luxury w-full pl-8 pr-2 py-3.5 rounded-xl text-sm" />
          </div>
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60" />
            <select value={pax} onChange={(e) => setPax(Number(e.target.value))}
              className="input-luxury w-full pl-8 pr-2 py-3.5 rounded-xl text-sm appearance-none">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-[#111]">{n} pax</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleClass)}
            className="input-luxury w-full px-4 py-3.5 rounded-xl text-sm appearance-none">
            {VEHICLE_CATALOG.map((v) => (
              <option key={v.class} value={v.class} className="bg-[#111]">
                {v.label} — up to {v.maxPassengers} pax
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
        </div>

        <AnimatePresence>
          {quote && !isCustomRoute && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-gold-500/5 border border-gold-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-gold-500" />
                    <span className="text-xs text-gold-400 tracking-wider uppercase font-medium">Fixed Price</span>
                  </div>
                  <span className="font-display text-2xl text-gold-400">{formatCurrency(quote.totalAmount)}</span>
                </div>
                {(quote.fromLabel || quote.toLabel) && (
                  <p className="text-xs text-dark-400 mb-2 flex items-center gap-1">
                    <MapPin size={10} className="text-gold-500/50 flex-shrink-0" />
                    {quote.fromLabel} → {quote.toLabel}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-dark-400 text-xs">Distance</p><p className="text-white text-sm font-medium">{quote.distanceKm} km</p></div>
                  <div><p className="text-dark-400 text-xs">Duration</p><p className="text-white text-sm font-medium">{quote.durationMin} min</p></div>
                  <div><p className="text-dark-400 text-xs">All-inclusive</p><p className="text-green-400 text-sm font-medium">Fixed</p></div>
                </div>
              </div>
            </motion.div>
          )}

          {isCustomRoute && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-400 font-medium text-sm mb-1">Custom route — we&apos;ll confirm your fixed price within 15 minutes.</p>
                <p className="text-dark-400 text-xs">This route isn&apos;t in our standard table. Send us your details and we&apos;ll quote you a fixed price by WhatsApp or email.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isCustomRoute ? (
          <a
            href="https://wa.me/34635383712"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold w-full py-4 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2"
          >
            <MessageCircle size={16} /> WhatsApp us for a quote
          </a>
        ) : (
          <button onClick={handleBook} disabled={!pickup.address || !dropoff.address || !date || !time}
            className="btn-gold w-full py-4 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            {quote ? `Book for ${formatCurrency(quote.totalAmount)}` : "Check Availability"}
            <ArrowRight size={16} />
          </button>
        )}

        <p className="text-center text-xs text-dark-500">Free cancellation up to 24h before pickup</p>
      </div>
    </div>
  );
}
