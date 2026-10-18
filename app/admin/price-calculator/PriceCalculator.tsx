"use client";

import { useEffect, useRef, useState } from "react";

interface Place { lat: number; lng: number; name?: string; label?: string; address?: string }
interface Quote { vehicle: string; badge: string | null; maxPassengers: number; total: number; basis: "table" | "distance" | "none"; fromLabel: string | null; toLabel: string | null }
interface Result {
  from: { lat: number; lng: number }; to: { lat: number; lng: number }; pickupAt: string;
  distanceKm: number; durationMin: number; preciseDistance: boolean;
  routeBasis: "road-network" | "estimate"; routeCoordinates: [number, number][]; quotes: Quote[];
}

const BASIS_TEXT: Record<Quote["basis"], string> = { table: "Fixed price from the table", distance: "Priced by distance", none: "No price: quote by hand" };
const nowLocal = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const placeText = (p: Place) => p.label || p.name || p.address || "";

function PlaceField({ label, value, onPick }: { label: string; value: Place | null; onPick: (p: Place | null) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Place[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const type = (v: string) => {
    setText(v);
    onPick(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geo/search?q=${encodeURIComponent(v.trim())}`);
        const j = await r.json();
        setOptions(j.results ?? []);
      } catch { setOptions([]); }
    }, 300);
  };

  return (
    <div className="relative">
      <label className="block text-xs uppercase tracking-wider text-dark-400 mb-1">{label}</label>
      <input
        value={value ? placeText(value) : text}
        onChange={(e) => type(e.target.value)}
        placeholder="Airport, hotel or address"
        className="w-full rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
      />
      {!value && options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-dark-600 bg-dark-900 shadow-xl">
          {options.map((o, i) => (
            <li key={i}>
              <button type="button" className="w-full text-left px-3 py-2 text-sm text-white hover:bg-dark-700" onClick={() => { onPick(o); setOptions([]); }}>
                {placeText(o)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RouteMap({ result }: { result: Result | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (dead || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { center: [41.39, 2.17], zoom: 9, zoomControl: true });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap © CARTO", maxZoom: 18 }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      layer.current!.clearLayers();
      if (!result) return;
      const a: [number, number] = [result.from.lat, result.from.lng];
      const b: [number, number] = [result.to.lat, result.to.lng];
      const line: [number, number][] = result.routeCoordinates.length ? result.routeCoordinates.map(([lng, lat]) => [lat, lng]) : [a, b];
      L.polyline(line, { color: "#E7B75F", weight: 5, opacity: 0.95, dashArray: result.routeBasis === "estimate" ? "8 8" : undefined }).addTo(layer.current!);
      L.circleMarker(a, { radius: 8, color: "#fff", fillColor: "#32C58A", fillOpacity: 1, weight: 2 }).addTo(layer.current!).bindTooltip("Pickup");
      L.circleMarker(b, { radius: 8, color: "#fff", fillColor: "#E7B75F", fillOpacity: 1, weight: 2 }).addTo(layer.current!).bindTooltip("Drop-off");
      map.current.fitBounds(L.latLngBounds(line), { padding: [40, 40] });
    })();
    return () => { dead = true; };
  }, [result]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  return <div ref={el} className="h-[360px] lg:h-full min-h-[360px] w-full rounded-xl overflow-hidden border border-dark-700" />;
}

export default function PriceCalculator() {
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [when, setWhen] = useState(nowLocal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const calculate = async () => {
    if (!from || !to) { setError("Choose both places from the suggestions."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/price-calculator", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pickup: { lat: from.lat, lng: from.lng, address: placeText(from) }, dropoff: { lat: to.lat, lng: to.lng, address: placeText(to) }, pickupDatetime: when }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Could not calculate."); setResult(null); } else setResult(j);
    } catch { setError("Network problem. Try again."); }
    setBusy(false);
  };

  const swap = () => { setFrom(to); setTo(from); setResult(null); };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-4">
        <PlaceField label="From" value={from} onPick={setFrom} />
        <PlaceField label="To" value={to} onPick={setTo} />
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs uppercase tracking-wider text-dark-400 mb-1">Pickup time (Barcelona)</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-lg bg-dark-800 border border-dark-600 px-3 py-2.5 text-white" />
          </div>
          <button type="button" onClick={swap} className="rounded-lg border border-dark-600 px-3 py-2.5 text-dark-300 hover:text-white" aria-label="Swap places">⇅</button>
        </div>
        <button type="button" onClick={calculate} disabled={busy} className="w-full rounded-lg bg-gold-400 text-dark-950 font-semibold py-3 disabled:opacity-60">
          {busy ? "Calculating…" : "Calculate price"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="rounded-xl border border-dark-700 bg-dark-900 p-4">
            <div className="flex justify-between text-sm text-dark-300">
              <span>{result.distanceKm} km · {result.durationMin} min</span>
              <span>{result.routeBasis === "road-network" ? "Road route" : "Straight-line estimate"}</span>
            </div>
            {!result.preciseDistance && <p className="text-xs text-amber-400 mt-1">Road routing was unavailable, so the distance is estimated.</p>}
            <table className="w-full mt-3 text-sm">
              <tbody>
                {result.quotes.map((q) => (
                  <tr key={q.vehicle} className="border-t border-dark-800">
                    <td className="py-2 pr-2 text-white">{q.vehicle}<div className="text-xs text-dark-400">up to {q.maxPassengers} · {BASIS_TEXT[q.basis]}</div></td>
                    <td className="py-2 text-right font-display text-lg text-gold-400">{q.basis === "none" ? "n/a" : `€${q.total.toFixed(2)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.quotes[0]?.fromLabel && <p className="text-xs text-dark-400 mt-2">Zones: {result.quotes[0].fromLabel} → {result.quotes[0].toLabel}</p>}
          </div>
        )}
      </div>
      <RouteMap result={result} />
    </div>
  );
}
