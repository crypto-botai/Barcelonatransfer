"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Calendar, Clock, Users, Zap, ArrowRight,
  Loader2, MessageCircle, MapPin, RotateCcw, Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VEHICLE_CATALOG, FLEET_TO_DB_CLASS, type FleetVehicle, type QuoteResponse } from "@/types";
import AddressAutocomplete, { type QuickZone } from "./AddressAutocomplete";
import { useTranslations } from "@/components/language/I18nProvider";

/* ── Quick-select zones (pickup + drop-off) ────────────────────────────────── */
// Addresses use short non-ambiguous strings so resolveZone() always identifies
// the correct zone — no province names that could shadow the city name.
const PICKUP_QUICK_ZONES: QuickZone[] = [
  // ── Airports / Hubs ───────────────────────────────────────────────────────
  { label: "Aeropuerto El Prat — T1", sublabel: "Terminal 1 · El Prat de Llobregat", address: "Terminal 1, El Prat Airport BCN",              lat: 41.2971, lng: 2.0785, icon: "airport" },
  { label: "Aeropuerto El Prat — T2", sublabel: "Terminal 2 · El Prat de Llobregat", address: "Terminal 2, El Prat Airport BCN",              lat: 41.2894, lng: 2.0718, icon: "airport" },
  { label: "Barcelona Ciudad",         sublabel: "Passeig de Gràcia · Eixample",      address: "Passeig de Gràcia, Barcelona city centre",    lat: 41.3916, lng: 2.1649, icon: "city"    },
  { label: "Puerto Cruceros BCN",      sublabel: "Moll Adossat · Port de Barcelona",  address: "Moll Adossat, cruise terminal port Barcelona", lat: 41.3611, lng: 2.1761, icon: "port"    },
  { label: "Estación de Sants",        sublabel: "AVE · Trenes larga distancia",      address: "Estació de Sants, Barcelona sants station",   lat: 41.3794, lng: 2.1401, icon: "train"   },
  { label: "Aeropuerto Girona (GRO)",  sublabel: "Costa Brava Airport (GRO)",         address: "Girona Costa Brava Airport, Vilobi",          lat: 41.9011, lng: 2.7604, icon: "airport" },
  { label: "Andorra La Vella",         sublabel: "Principado de Andorra",             address: "Andorra la Vella, Andorra",                   lat: 42.5063, lng: 1.5218, icon: "landmark"},
  { label: "Montserrat",               sublabel: "Monasterio · 1h de BCN",            address: "Montserrat Monastery, Monistrol de Montserrat",lat: 41.5928, lng: 1.8363, icon: "landmark"},
  // ── Costa Dorada ─────────────────────────────────────────────────────────
  { label: "Castelldefels",    sublabel: "Costa Dorada · 25 min",  address: "Castelldefels, Baix Llobregat",              lat: 41.2800, lng: 1.9780, icon: "landmark" },
  { label: "Sitges",           sublabel: "Costa Dorada · 35 min",  address: "Sitges, Garraf",                             lat: 41.2369, lng: 1.8109, icon: "landmark" },
  { label: "Cubelles",         sublabel: "Costa Dorada · 45 min",  address: "Cubelles, Garraf",                           lat: 41.2134, lng: 1.6764, icon: "landmark" },
  { label: "Calafell",         sublabel: "Costa Dorada · 50 min",  address: "Calafell, Baix Penedes",                     lat: 41.1977, lng: 1.5675, icon: "landmark" },
  { label: "Vendrell",         sublabel: "Costa Dorada · 55 min",  address: "El Vendrell, Baix Penedes",                  lat: 41.2172, lng: 1.5374, icon: "landmark" },
  { label: "Tarragona",        sublabel: "Costa Dorada · 1h",      address: "Tarragona city centre",                      lat: 41.1189, lng: 1.2445, icon: "landmark" },
  { label: "La Pineda",        sublabel: "Costa Dorada · 1h05",    address: "La Pineda, Vila-seca",                       lat: 41.0750, lng: 1.1540, icon: "landmark" },
  { label: "Salou",            sublabel: "Costa Dorada · 1h05",    address: "Salou, Vila-seca",                           lat: 41.0765, lng: 1.1426, icon: "landmark" },
  { label: "PortAventura World",sublabel: "Salou · 1h05",          address: "PortAventura World, Salou",                  lat: 41.0864, lng: 1.1546, icon: "landmark" },
  { label: "Cambrils",         sublabel: "Costa Dorada · 1h10",    address: "Cambrils, Baix Camp",                        lat: 41.0652, lng: 1.0594, icon: "landmark" },
  // ── Costa Brava ──────────────────────────────────────────────────────────
  { label: "Mataró",           sublabel: "Costa Brava · 30 min",   address: "Mataro, Maresme",                            lat: 41.5388, lng: 2.4450, icon: "landmark" },
  { label: "Calella",          sublabel: "Costa Brava · 45 min",   address: "Calella, Maresme",                           lat: 41.6175, lng: 2.6575, icon: "landmark" },
  { label: "Pineda de Mar",    sublabel: "Costa Brava · 50 min",   address: "Pineda de Mar, Maresme",                     lat: 41.6249, lng: 2.6835, icon: "landmark" },
  { label: "Santa Susanna",    sublabel: "Costa Brava · 55 min",   address: "Santa Susanna, Maresme",                     lat: 41.6736, lng: 2.7139, icon: "landmark" },
  { label: "Malgrat de Mar",   sublabel: "Costa Brava · 55 min",   address: "Malgrat de Mar, Maresme",                    lat: 41.6475, lng: 2.7477, icon: "landmark" },
  { label: "Blanes",           sublabel: "Costa Brava · 1h",       address: "Blanes, Selva",                              lat: 41.6747, lng: 2.7897, icon: "landmark" },
  { label: "Lloret de Mar",    sublabel: "Costa Brava · 1h",       address: "Lloret de Mar, Selva",                       lat: 41.6993, lng: 2.8469, icon: "landmark" },
  { label: "Tossa de Mar",     sublabel: "Costa Brava · 1h10",     address: "Tossa de Mar, Selva",                        lat: 41.7218, lng: 2.9330, icon: "landmark" },
  { label: "Platja d'Aro",     sublabel: "Costa Brava · 1h20",     address: "Platja d'Aro, Baix Emporda",                 lat: 41.8174, lng: 3.0648, icon: "landmark" },
  { label: "Palamós",          sublabel: "Costa Brava · 1h25",     address: "Palamos, Baix Emporda",                      lat: 41.8449, lng: 3.1304, icon: "landmark" },
  { label: "Roses",            sublabel: "Costa Brava · 1h45",     address: "Roses, Alt Emporda",                         lat: 42.2688, lng: 3.1760, icon: "landmark" },
  { label: "Empuriabrava",     sublabel: "Costa Brava · 1h50",     address: "Empuriabrava, Alt Emporda",                  lat: 42.2494, lng: 3.1166, icon: "landmark" },
  { label: "Figueres",         sublabel: "Costa Brava · 1h45",     address: "Figueres, Alt Emporda",                      lat: 42.2676, lng: 2.9624, icon: "landmark" },
  { label: "Cadaqués",         sublabel: "Costa Brava · 2h",       address: "Cadaques, Alt Emporda",                      lat: 42.2882, lng: 3.2787, icon: "landmark" },
];

type TripType = "oneway" | "return" | "hourly";

const TRIP_TABS: { type: TripType; labelKey: string; icon: React.ElementType }[] = [
  { type: "oneway",  labelKey: "tripOneWay", icon: ArrowRight },
  { type: "return",  labelKey: "tripReturn", icon: RotateCcw },
  { type: "hourly",  labelKey: "tripHourly", icon: Timer },
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
  const t = useTranslations("booking");
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
        fleetVehicle:   vehicle,
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
      // The car itself, not its class. Sending the class lost which car was
      // chosen: a Camry quoted at €60 here arrived at /book as "BUSINESS" and
      // was re-quoted at the €65 column price, so the fare rose by €5 at the
      // exact moment the customer committed. /book accepts either — it maps a
      // fleet key back to its class — so the specific value is the safe one.
      vehicle:     vehicle,
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

  // Routes outside the fixed table are priced per kilometre and are bookable.
  // This flag means only that no price could be produced at all.
  const needsManualQuote = quote != null && (quote.needsManualQuote === true || quote.totalAmount <= 0);
  // Distance-priced rather than read from the table — labelled differently.
  const isPerKm          = quote?.isCustomRoute === true && !needsManualQuote;
  const canContinue    = !!pickup.address && !!date && !!time && (isHourly || !!dropoff.address);

  return (
    <div className={cn(
      "rounded-2xl overflow-hidden border border-white/[0.07]",
      compact ? "" : ""
    )}>

      {/* ── Gold header ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#c9a84c] via-[#b8913d] to-[#a07828] px-6 pt-5 pb-4">
        <p className="text-black/50 text-[10px] font-semibold uppercase tracking-[0.2em] mb-1">{t("headerEyebrow")}</p>
        <h2 className="font-display text-xl text-black leading-tight">{t("headerTitle")}</h2>
        <p className="text-black/40 text-xs mt-0.5">{t("headerSubtitle")}</p>

        {/* Trip type tabs */}
        <div className="flex gap-1.5 mt-4">
          {TRIP_TABS.map(({ type, labelKey, icon: Icon }) => (
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
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Form body ───────────────────────────────────────────────────────── */}
      <div className="bg-[#0c0c0c] px-6 py-5 space-y-4">

        {/* Where label */}
        <p className="text-white/50 text-xs font-medium tracking-wide">{t("whereTo")}</p>

        {/* Pickup */}
        <div>
          <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("pickup")}</label>
          <AddressAutocomplete
            value={pickup.address}
            onChange={setPickup}
            placeholder={t("pickupPlaceholder")}
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
        {!isHourly && (
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("dropoff")}</label>
            <AddressAutocomplete
              value={dropoff.address}
              onChange={setDropoff}
              placeholder={t("dropoffPlaceholder")}
              icon={<div className="w-4 h-4 rounded-full border-2 border-[#c9a84c] flex items-center justify-center flex-shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]" /></div>}
              quickZones={PICKUP_QUICK_ZONES}
            />
          </div>
        )}

        {/* Hours selector (hourly only) */}
        {isHourly && (
          <div>
            <label className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-2">{t("duration")}</label>
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
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="hero-booking-date" className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("date")}</label>
            <div className="relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none z-10" />
              <input
                id="hero-booking-date"
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label htmlFor="hero-booking-time" className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("time")}</label>
            <div className="relative">
              <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none z-10" />
              <select
                id="hero-booking-time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm appearance-none"
              >
                <option value="" className="bg-[#111]">{t("timePlaceholder")}</option>
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
            <label htmlFor="hero-booking-pax" className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("passengers")}</label>
            <div className="relative">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c9a84c]/50 pointer-events-none" />
              <select
                id="hero-booking-pax"
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                className="input-luxury w-full pl-8 pr-3 py-3 rounded-xl text-sm appearance-none"
              >
                {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-[#111]">{t("pax").replace("{n}", String(n))}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="hero-booking-vehicle" className="block text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.15em] font-semibold mb-1.5">{t("vehicle")}</label>
            <div className="relative">
              <select
                id="hero-booking-vehicle"
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

        {/* Quote result.
            Three fades, done in CSS. This form is embedded in the hero, so it
            was the last thing keeping framer-motion in the homepage's initial
            bundle — every visitor downloaded and parsed the library before the
            header would answer a tap, for three opacity transitions. */}
        <>
          {loading && (
            <div className="animate-fade-in flex items-center justify-center gap-2 py-2 text-xs text-white/30">
              <Loader2 size={13} className="animate-spin text-[#c9a84c]" />
              {t("gettingPrice")}
            </div>
          )}

          {!loading && quote && !needsManualQuote && (
            <div className="animate-menu-in">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#c9a84c]/5 border border-[#c9a84c]/20">
                <Zap size={13} className="text-[#c9a84c] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[#c9a84c]/60 uppercase tracking-wide font-semibold">
                    {t("fixedPrice")}
                  </p>
                  {quote.fromLabel ? (
                    <p className="text-[11px] text-white/30 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin size={9} className="text-[#c9a84c]/40 flex-shrink-0" />
                      {quote.fromLabel} → {quote.toLabel}
                    </p>
                  ) : isPerKm ? (
                    <p className="text-[11px] text-white/30 flex items-center gap-1 mt-0.5">
                      <MapPin size={9} className="text-[#c9a84c]/40 flex-shrink-0" />
                      {t("kmJourney").replace("{km}", String(quote.distanceKm))}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {!loading && needsManualQuote && (
            <div className="animate-menu-in">
              <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-amber-400 text-xs font-medium">{t("couldNotPrice")}</p>
              </div>
            </div>
          )}
        </>

        {/* CTA */}
        {needsManualQuote ? (
          <a
            href="https://wa.me/34635383712"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle size={15} /> {t("whatsappQuote")}
          </a>
        ) : (
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="btn-gold w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {t("continueLabel")}
            <ArrowRight size={15} />
          </button>
        )}

        {/* Footer trust bar */}
        <div className="flex items-center justify-center gap-4 pt-1">
          {([t("badgeFleet"), t("badgeAvailability"), t("badgeLanguages")] as const).map((badge) => (
            <span key={badge} className="text-[10px] text-white/50 uppercase tracking-wider">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
