"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export interface QuickZone {
  label: string;
  sublabel?: string;
  address: string;
  lat: number;
  lng: number;
  icon?: "airport" | "city" | "port" | "train" | "landmark";
}

interface Props {
  value: string;
  onChange: (val: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  quickZones?: QuickZone[];
}

function ZoneIcon({ type }: { type?: QuickZone["icon"] }) {
  const base = "text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0";
  if (type === "airport") return <span className={`${base} bg-[#c9a84c]/15 text-[#c9a84c]`}>✈</span>;
  if (type === "port")    return <span className={`${base} bg-blue-500/15 text-blue-400`}>⚓</span>;
  if (type === "train")   return <span className={`${base} bg-purple-500/15 text-purple-400`}>🚂</span>;
  if (type === "landmark") return <span className={`${base} bg-emerald-500/15 text-emerald-400`}>⬟</span>;
  return <MapPin size={12} className="text-[#c9a84c] flex-shrink-0" />;
}

export default function AddressAutocomplete({
  value, onChange, placeholder, icon, className, quickZones,
}: Props) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const showZones = !!(quickZones?.length && query.length < 3);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      if (data.length > 0) setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange({ address: q, lat: 0, lng: 0 });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 400);
  };

  const select = (s: Suggestion) => {
    const address = s.display_name;
    setQuery(address);
    onChange({ address, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
    setSuggestions([]);
    setOpen(false);
  };

  const selectZone = (z: QuickZone) => {
    setQuery(z.label);
    onChange({ address: z.address, lat: z.lat, lng: z.lng });
    setSuggestions([]);
    setOpen(false);
  };

  const handleFocus = () => {
    if (showZones || suggestions.length > 0) setOpen(true);
  };

  const hasDropdown = open && (showZones || suggestions.length > 0);

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
        {loading
          ? <Loader2 size={14} className="text-[#c9a84c] animate-spin" />
          : icon ?? <MapPin size={14} className="text-[#c9a84c]" />}
      </div>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder={placeholder}
        className={cn("input-luxury w-full pl-10 pr-4 py-4 rounded-xl", className)}
        autoComplete="off"
      />

      {hasDropdown && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#0e0e0e] border border-white/[0.09] rounded-xl shadow-2xl overflow-hidden">

          {/* Fixed-price zones (shown when query is short) */}
          {showZones && quickZones && (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                <Navigation size={10} className="text-[#c9a84c]/60" />
                <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.2em] font-semibold">
                  Fixed-price zones
                </span>
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {quickZones.map((z, i) => (
                  <li
                    key={i}
                    onMouseDown={() => selectZone(z)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#c9a84c]/[0.07] cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors"
                  >
                    <ZoneIcon type={z.icon} />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{z.label}</p>
                      {z.sublabel && (
                        <p className="text-[11px] text-white/30 truncate">{z.sublabel}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/20">Or type any address below for a custom quote</p>
              </div>
            </>
          )}

          {/* Nominatim suggestions (shown when user is typing) */}
          {!showZones && suggestions.length > 0 && (
            <ul>
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => select(s)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm text-white hover:bg-[#c9a84c]/[0.07] cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors"
                >
                  <MapPin size={12} className="text-[#c9a84c] flex-shrink-0 mt-px" />
                  <span className="truncate">{s.display_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
