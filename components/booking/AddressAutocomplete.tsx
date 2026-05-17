"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChange: (val: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function AddressAutocomplete({ value, onChange, placeholder, icon, className }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=es,fr,pt,ad`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
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

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
        {loading ? <Loader2 size={14} className="text-gold-500 animate-spin" /> : icon ?? <MapPin size={14} className="text-gold-500" />}
      </div>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cn("input-luxury w-full pl-10 pr-4 py-4 rounded-xl", className)}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[#111] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => select(s)}
              className="px-4 py-3 text-sm text-white hover:bg-gold-500/10 cursor-pointer border-b border-white/[0.04] last:border-0 truncate">
              <MapPin size={12} className="inline text-gold-500 mr-2 shrink-0" />
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
