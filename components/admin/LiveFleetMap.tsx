"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL } from "@/lib/map-style";

interface Fleet {
  generatedAt: string;
  rides: FleetRide[];
}

interface FleetRide {
  id: string;
  code: string;
  status: string;
  stage: string | null;
  pickupAt: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number | null; lng: number | null } | null;
  driver: { id: string; name: string | null; phone: string | null; car: string | null; plate: string | null } | null;
  position: { lat: number; lng: number; speed: number | null; heading: number | null; at: string; ageSeconds: number | null } | null;
  trackingState: "live" | "delayed" | "stale" | "no-signal";
  leg: { toward: "PICKUP" | "DROPOFF"; km: number; minutes: number; arrivesAt: string; basis: string; line: [number, number][] } | null;
  customer: { lat: number | null; lng: number | null; at: string } | null;
}

const STATE_COLOR: Record<FleetRide["trackingState"], string> = { live: "#10D99B", delayed: "#F2B84B", stale: "#E5484D", "no-signal": "#8793A5" };
const STATE_LABEL: Record<FleetRide["trackingState"], string> = { live: "Live", delayed: "Delayed", stale: "Stale GPS", "no-signal": "No GPS yet" };

const dot = (color: string, size = 16, ring = "#fff") => {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${ring};box-shadow:0 0 0 2px rgba(0,0,0,.35)`;
  return el;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/**
 * Admin live fleet: the rides under way on one MapLibre map, refreshed every 8 seconds from /api/admin/live-fleet (which checks the
 * ADMIN role on the server). Green/amber/red/grey dots are the freshness of each driver's GPS; a blue dot is a passenger who chose to
 * share their position. The line and time are road-network estimates, not live traffic.
 */
export default function LiveFleetMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [data, setData] = useState<Fleet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-fleet", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Sign in as an administrator." : "Could not load the fleet.");
      setData((await res.json()) as Fleet);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the fleet.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    let dead = false;
    void import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      const m = new ml.Map({ container: box.current, style: MAP_STYLE_URL, center: [2.1734, 41.3851], zoom: 10 });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        loaded.current = true;
        m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        m.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": "#E7B75F", "line-width": 4, "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
        setData((d) => (d ? { ...d } : d));
      });
      map.current = m;
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      loaded.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !data) return;
    void import("maplibre-gl").then((ml) => {
      markers.current.forEach((x) => x.remove());
      markers.current = [];
      const add = (el: HTMLElement, lng: number, lat: number, title: string) => {
        el.title = title;
        markers.current.push(new ml.Marker({ element: el }).setLngLat([lng, lat]).addTo(m));
      };
      const shown = data.rides.filter((r) => !selected || r.id === selected);
      for (const r of shown) {
        add(dot("#fff", 10, "#5B6B7A"), r.pickup.lng, r.pickup.lat, `Pickup ${r.pickup.address}`);
        if (r.dropoff && r.dropoff.lat && r.dropoff.lng) add(dot("#E7B75F", 10, "#fff"), r.dropoff.lng, r.dropoff.lat, `Destination ${r.dropoff.address}`);
        if (r.position) add(dot(STATE_COLOR[r.trackingState], 20), r.position.lng, r.position.lat, `${r.code} · ${r.driver?.name ?? "Driver"} · ${STATE_LABEL[r.trackingState]}`);
        if (r.customer && r.customer.lat && r.customer.lng) add(dot("#168DFF", 14), r.customer.lng, r.customer.lat, `${r.code} · passenger (sharing)`);
      }
      const src = m.getSource("routes") as { setData?: (d: unknown) => void } | undefined;
      src?.setData?.({ type: "FeatureCollection", features: shown.filter((r) => r.leg && r.leg.line.length > 1).map((r) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.leg!.line } })) });
    });
  }, [data, selected]);

  useEffect(() => {
    const m = map.current;
    if (!m || !data || !selected) return;
    const r = data.rides.find((x) => x.id === selected);
    const p = r?.position ?? (r ? { lat: r.pickup.lat, lng: r.pickup.lng } : null);
    if (p) m.flyTo({ center: [p.lng, p.lat], zoom: 14 });
  }, [selected, data]);

  const rides = data?.rides ?? [];
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row">
      <aside className="w-full overflow-y-auto border-b border-white/10 bg-[#07131C] p-4 text-sm text-white md:w-96 md:border-b-0 md:border-r">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Live fleet</h1>
          <span className="text-xs text-white/60">{rides.length} active</span>
        </div>
        {error ? <p className="mb-3 rounded bg-red-500/20 p-2 text-red-200">{error}</p> : null}
        {selected ? (
          <button className="mb-3 text-xs text-[#FFD889] underline" onClick={() => setSelected(null)}>
            Show all rides
          </button>
        ) : null}
        <ul className="space-y-2">
          {rides.map((r) => (
            <li key={r.id}>
              <button onClick={() => setSelected(r.id)} className={`w-full rounded-lg border p-3 text-left ${selected === r.id ? "border-[#E7B75F]" : "border-white/10"} bg-white/5`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.code}</span>
                  <span className="flex items-center gap-1 text-xs">
                    <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: STATE_COLOR[r.trackingState] }} />
                    {STATE_LABEL[r.trackingState]}
                    {typeof r.position?.ageSeconds === "number" ? ` · ${r.position.ageSeconds}s` : ""}
                  </span>
                </div>
                <div className="mt-1 text-white/70">{r.driver?.name ?? "No driver"}{r.driver?.plate ? ` · ${r.driver.plate}` : ""}</div>
                <div className="text-white/50">{r.stage ?? r.status} · pickup {time(r.pickupAt)}</div>
                <div className="truncate text-white/50">{r.pickup.address}</div>
                {r.leg ? (
                  <div className="mt-1 text-[#FFD889]">
                    {r.leg.km} km to {r.leg.toward === "PICKUP" ? "pickup" : "destination"} · ~{r.leg.minutes} min · arrives {time(r.leg.arrivesAt)}
                    <span className="text-white/40"> {r.leg.basis === "road-network" ? "(road estimate, no live traffic)" : "(straight-line estimate)"}</span>
                  </div>
                ) : null}
                {r.customer ? <div className="text-[#6CB6FF]">Passenger is sharing location</div> : null}
              </button>
            </li>
          ))}
          {rides.length === 0 && !error ? <li className="text-white/50">No rides are active right now.</li> : null}
        </ul>
        <p className="mt-4 text-xs text-white/40">White dot: pickup · gold: destination · coloured: driver GPS freshness · blue: passenger sharing. Passenger positions are shown only while they share and each view is logged.</p>
      </aside>
      <div ref={box} className="min-h-[320px] flex-1" />
    </div>
  );
}
