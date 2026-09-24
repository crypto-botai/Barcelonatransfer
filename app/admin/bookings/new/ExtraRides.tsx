"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import { FLEET_TO_DB_CLASS, VEHICLE_CATALOG, type FleetVehicle } from "@/types";

/**
 * The rest of one customer's journeys.
 *
 * A guest on a week's stay is one customer and several jobs: in from the
 * airport, across town when they change hotel, out to the airport again. The
 * office was entering those as unrelated bookings and retyping the name,
 * email and phone each time, which is slow and is how a phone number ends up
 * differing between two rides of the same trip.
 *
 * Each ride here becomes a booking of its own with its own reference and its
 * own confirmation, because each is its own job on its own day. What they
 * share is the customer, and one payment covering the lot.
 */

export type Place = { address: string; lat: number; lng: number };

export interface ExtraRide {
  /** Local only, for React and for removing the right row. */
  key: string;
  pickup: Place;
  dropoff: Place;
  date: string;
  time: string;
  vehicle: FleetVehicle;
  /** How many cars this ride needs; each becomes a booking of its own. */
  vehicleCount: number;
  price: string;
  flight: string;
  notes: string;
}

export const blankRide = (vehicle: FleetVehicle): ExtraRide => ({
  key: Math.random().toString(36).slice(2),
  pickup:  { address: "", lat: 0, lng: 0 },
  dropoff: { address: "", lat: 0, lng: 0 },
  date: "", time: "", vehicle, vehicleCount: 1, price: "", flight: "", notes: "",
});

/** A ride the office has filled in far enough to be worth creating. */
export function rideReady(r: ExtraRide): boolean {
  const n = parseFloat(r.price);
  return !!r.pickup.address && !!r.dropoff.address && !!r.date && !!r.time && Number.isFinite(n) && n >= 0;
}

/** Each price is one car's; a ride needing four of them costs four times it. */
export function rideTotal(rides: ExtraRide[]): number {
  return rides.reduce((s, r) => {
    const n = parseFloat(r.price);
    return s + (Number.isFinite(n) ? n : 0) * r.vehicleCount;
  }, 0);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const field = "input-luxury w-full px-3 py-2.5 rounded-lg text-sm";
const label = "block text-[10px] text-gold-500/80 uppercase tracking-[0.15em] font-semibold mb-1.5";

export default function ExtraRides({ rides, onChange, defaultVehicle, passengers }: {
  rides: ExtraRide[];
  onChange: (next: ExtraRide[]) => void;
  defaultVehicle: FleetVehicle;
  passengers: number;
}) {
  const set = (key: string, patch: Partial<ExtraRide>) =>
    onChange(rides.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-white font-medium">More rides for this customer</h2>
          <p className="text-dark-400 text-[12px] mt-0.5">
            Other journeys during their stay. Each becomes its own booking with its own reference, charged together with the first.
          </p>
        </div>
      </div>

      {rides.length > 0 && (
        <div className="space-y-3 mt-4">
          {rides.map((r, i) => (
            <RideCard
              key={r.key}
              index={i}
              ride={r}
              passengers={passengers}
              onPatch={(patch) => set(r.key, patch)}
              onRemove={() => onChange(rides.filter((x) => x.key !== r.key))}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...rides, blankRide(defaultVehicle)])}
        className="mt-4 w-full rounded-xl border border-dashed border-white/[0.14] hover:border-gold-500/40 hover:bg-gold-500/[0.04] py-3 text-sm text-dark-300 hover:text-white inline-flex items-center justify-center gap-2 transition-colors"
      >
        <Plus size={15} /> {rides.length === 0 ? "Add another ride" : "Add one more"}
      </button>
    </section>
  );
}

function RideCard({ index, ride, passengers, onPatch, onRemove }: {
  index: number;
  ride: ExtraRide;
  passengers: number;
  onPatch: (patch: Partial<ExtraRide>) => void;
  onRemove: () => void;
}) {
  const [quote, setQuote]     = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [touched, setTouched] = useState(false);

  // The same price the website would give for this leg, so a customer booking
  // three rides by phone is not quoted differently from one booking online.
  const fetchQuote = useCallback(async () => {
    if (!ride.pickup.lat || !ride.dropoff.lat || !ride.date || !ride.time) return;
    setQuoting(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingType: "TRANSFER",
          pickupLat: ride.pickup.lat, pickupLng: ride.pickup.lng,
          dropoffLat: ride.dropoff.lat, dropoffLng: ride.dropoff.lng,
          vehicleClass: FLEET_TO_DB_CLASS[ride.vehicle], fleetVehicle: ride.vehicle,
          pickupDatetime: `${ride.date}T${ride.time}`, passengers,
          pickupAddress: ride.pickup.address, dropoffAddress: ride.dropoff.address,
        }),
      });
      if (res.ok) {
        const q = await res.json();
        setQuote(q.totalAmount);
        if (!touched) onPatch({ price: String(q.totalAmount) });
      }
    } finally {
      setQuoting(false);
    }
    // onPatch changes identity every render; the inputs below are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.pickup, ride.dropoff, ride.date, ride.time, ride.vehicle, passengers, touched]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-gold-500/80 font-semibold">Ride {index + 2}</span>
        <button
          type="button"
          onClick={onRemove}
          title="Remove this ride"
          className="inline-flex items-center gap-1.5 text-[11px] text-dark-400 hover:text-red-300 transition-colors"
        >
          <Trash2 size={12} /> Remove
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className={label}>Pick-up</label>
          <AddressAutocomplete
            value={ride.pickup.address}
            onChange={(v) => onPatch({ pickup: v })}
            placeholder="Airport terminal, hotel, address…"
            icon={<MapPin size={14} className="text-gold-500" />}
          />
        </div>
        <div>
          <label className={label}>Drop-off</label>
          <AddressAutocomplete
            value={ride.dropoff.address}
            onChange={(v) => onPatch({ dropoff: v })}
            placeholder="Destination"
            icon={<MapPin size={14} className="text-gold-500" />}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className={label}>Date</label>
            <input className={`${field} [color-scheme:dark]`} type="date" min={todayStr()} value={ride.date} onChange={(e) => onPatch({ date: e.target.value })} />
          </div>
          <div>
            <label className={label}>Time</label>
            <input className={`${field} [color-scheme:dark]`} type="time" value={ride.time} onChange={(e) => onPatch({ time: e.target.value })} />
          </div>
          <div>
            <label className={label}>Vehicle</label>
            <select className={field} value={ride.vehicle} onChange={(e) => onPatch({ vehicle: e.target.value as FleetVehicle })}>
              {VEHICLE_CATALOG.map((v) => <option key={v.class} value={v.class}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Cars</label>
            <input
              className={field}
              type="number" min={1} max={10}
              value={ride.vehicleCount}
              onChange={(e) => onPatch({ vehicleCount: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) })}
            />
          </div>
          <div>
            <label className={label}>Price (€){ride.vehicleCount > 1 && <span className="normal-case tracking-normal text-dark-500"> each</span>}</label>
            <input
              className={field}
              type="number" min={0} step="0.5"
              value={ride.price}
              onChange={(e) => { onPatch({ price: e.target.value }); setTouched(true); }}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-[11px] text-dark-400 inline-flex items-center gap-1">
            {quoting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-gold-500" />}
            {quote != null ? `Website price €${quote.toFixed(2)}` : "Website price appears once the route is set"}
          </span>
          {quote != null && touched && parseFloat(ride.price) !== quote && (
            <button type="button" onClick={() => { onPatch({ price: String(quote) }); setTouched(false); }} className="text-[11px] text-gold-400 hover:underline">
              Use website price
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3">
          <div>
            <label className={label}>Flight number</label>
            <input className={field} value={ride.flight} onChange={(e) => onPatch({ flight: e.target.value })} placeholder="VY8301" />
          </div>
          <div>
            <label className={label}>Notes for the chauffeur</label>
            <input className={field} value={ride.notes} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Child seat, meeting point…" />
          </div>
        </div>
      </div>
    </div>
  );
}
