"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MapPin, Loader2, Navigation, Plane, Train, Ship, BedDouble, Building2, Landmark, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the customer is going, typed.
 *
 * This field is the whole booking. Nothing downstream can recover from it
 * being wrong: the quote geocodes what is in it, so a customer who could not
 * find their destination here did not get a worse price, they got no price at
 * all and a "contact us on WhatsApp" they mostly did not send.
 *
 * Two things were wrong with it. The search underneath matched literally, so
 * one wrong letter returned an empty list; that is fixed in lib/geo. And the
 * list itself could only be used with a mouse, printed ninety characters of
 * administrative hierarchy per row, and gave no way to tell an airport from a
 * street corner. This is that half.
 */

export interface PlaceResult {
  lat: number;
  lng: number;
  label: string;
  name?: string;
  context?: string;
  kind?: "airport" | "train" | "port" | "hotel" | "city" | "landmark" | "address";
  id?: string;
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

/** Kept small and recent: a list you have to read is not a shortcut. */
const RECENTS_KEY = "ebcn.recent-places";
const MAX_RECENTS = 4;

type Recent = { label: string; name?: string; context?: string; lat: number; lng: number; kind?: PlaceResult["kind"] };

function readRecents(): Recent[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? (JSON.parse(raw) as Recent[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && r.label && Number.isFinite(r.lat)).slice(0, MAX_RECENTS) : [];
  } catch {
    // Private browsing, blocked storage, or somebody else's JSON under our key.
    return [];
  }
}

function pushRecent(r: Recent) {
  try {
    const next = [r, ...readRecents().filter((x) => x.label !== r.label)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch { /* never block a booking on storage */ }
}

/**
 * Every list in the dropdown scrolls.
 *
 * The panel around them is overflow-hidden, to keep its rounded corners, so a
 * list without this is simply cut off at the bottom with no way to reach the
 * rest: the fixed-price zones and a full set of results both run past the
 * fold. overscroll-contain stops the page behind it scrolling once the list
 * hits its end, which on a phone reads as the whole form jumping.
 *
 * The height itself is measured at open time against the room below the field
 * and passed in, because a fixed cap hangs off the bottom of the window when
 * the field sits low down a form.
 */
const LIST_CLS = "overflow-y-auto overscroll-contain";

const KIND_ICON = {
  airport:  Plane,
  train:    Train,
  port:     Ship,
  hotel:    BedDouble,
  city:     Building2,
  landmark: Landmark,
  address:  MapPin,
} as const;

function KindIcon({ kind, className }: { kind?: PlaceResult["kind"]; className?: string }) {
  const Icon = KIND_ICON[kind ?? "address"] ?? MapPin;
  return <Icon size={14} className={className} aria-hidden />;
}

function ZoneIcon({ type }: { type?: QuickZone["icon"] }) {
  const base = "text-[10px] font-bold w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0";
  if (type === "airport")  return <span className={`${base} bg-[#c9a84c]/15 text-[#c9a84c]`}><Plane size={12} aria-hidden /></span>;
  if (type === "port")     return <span className={`${base} bg-sky-500/15 text-sky-400`}><Ship size={12} aria-hidden /></span>;
  if (type === "train")    return <span className={`${base} bg-violet-500/15 text-violet-300`}><Train size={12} aria-hidden /></span>;
  if (type === "landmark") return <span className={`${base} bg-emerald-500/15 text-emerald-400`}><Landmark size={12} aria-hidden /></span>;
  return <span className={`${base} bg-white/[0.06] text-[#c9a84c]`}><MapPin size={12} aria-hidden /></span>;
}

/**
 * The part of the row that matched what was typed, in white.
 *
 * Matching on the accent-stripped string so that typing "sagrada famili"
 * highlights inside "Sagrada Família", which is the case where a customer
 * most needs telling that the row is the one they meant.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const i = fold(text).indexOf(fold(q));
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-white font-medium">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function AddressAutocomplete({
  value, onChange, placeholder, icon, className, quickZones,
}: Props) {
  const [query,       setQuery]       = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [active,      setActive]      = useState(-1);
  const [recents,     setRecents]     = useState<Recent[]>([]);
  const [noResults,   setNoResults]   = useState(false);

  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef   = useRef<HTMLUListElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const reduce    = useReducedMotion();
  const listId    = useId();

  /**
   * How much room there is, and which way to open.
   *
   * A fixed height is wrong for a field that can sit anywhere down a long
   * form. The dropoff box on a desktop booking form sits low enough that a
   * 288px panel hangs 149px below the bottom of the window: the last rows are
   * cut off by the window edge, and scrolling inside the list does nothing
   * because its content fits the height it was given. It reads as a stuck
   * list, which is exactly what it is.
   *
   * So the panel is measured against the space actually available and flips
   * above the field when there is more room up there.
   */
  const [place, setPlace] = useState<{ up: boolean; maxH: number }>({ up: false, maxH: 288 });

  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 14;
    const below = window.innerHeight - r.bottom - gap;
    const above = r.top - gap;
    // Opening upward is the worse option when it is merely tighter, because a
    // list that covers the field it belongs to is disorienting. Only flip when
    // downward is genuinely too small to be usable.
    const up = below < 200 && above > below;
    setPlace({ up, maxH: Math.max(140, Math.min(288, up ? above : below)) });
  }, []);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => { setRecents(readRecents()); }, []);

  const short = query.trim().length < 2;
  const showZones = !!(quickZones?.length && short);
  const showRecents = !showZones && short && recents.length > 0;

  /**
   * Goes through our own /api/geo/search rather than calling the geocoder
   * directly. A browser cannot set the User-Agent Nominatim's policy requires,
   * and hitting a free community service once per keystroke from every
   * visitor's IP is the kind of load that gets an application blocked. The
   * proxy adds a shared cache and the Barcelona bias.
   */
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setNoResults(false); return; }
    // Keystrokes can resolve out of order; only the newest answer may write.
    const mine = ++requestId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(String(res.status));
      const { results } = await res.json() as { results: PlaceResult[] };
      if (mine !== requestId.current) return;
      setSuggestions(results);
      setNoResults(results.length === 0);
      setActive(results.length > 0 ? 0 : -1);
      setOpen(true);
    } catch {
      if (mine !== requestId.current) return;
      setSuggestions([]);
      setNoResults(true);
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    // Coordinates are cleared because they no longer describe what is typed.
    // The server geocodes the text when none arrive, so a customer who types a
    // real address and never opens the list still gets a price.
    onChange({ address: q, lat: 0, lng: 0 });
    setOpen(true);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    // 200ms, not 400: the search behind this is an index built for type-ahead
    // and answers in well under that, so the old delay was most of the wait.
    timer.current = setTimeout(() => search(q), 200);
  };

  const commit = (address: string, lat: number, lng: number, extra?: Partial<Recent>) => {
    setQuery(address);
    onChange({ address, lat, lng });
    pushRecent({ label: address, lat, lng, ...extra });
    setRecents(readRecents());
    setSuggestions([]);
    setNoResults(false);
    setOpen(false);
    setActive(-1);
  };

  const select     = (s: PlaceResult) => commit(s.label, s.lat, s.lng, { name: s.name, context: s.context, kind: s.kind });
  const selectZone = (z: QuickZone)   => commit(z.address, z.lat, z.lng, { name: z.label, context: z.sublabel, kind: z.icon });
  const selectRecent = (r: Recent)    => commit(r.label, r.lat, r.lng, { name: r.name, context: r.context, kind: r.kind });

  /** Every row currently on screen, so the keyboard walks what the eye sees. */
  const rows = useMemo(() => {
    if (showZones && quickZones) return quickZones.map((z) => ({ go: () => selectZone(z) }));
    if (showRecents) return recents.map((r) => ({ go: () => selectRecent(r) }));
    return suggestions.map((s) => ({ go: () => select(s) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showZones, showRecents, quickZones, recents, suggestions]);

  const hasDropdown = open && (showZones || showRecents || suggestions.length > 0 || noResults || loading);

  // Arrow keys, Enter and Escape. Without these the field could only be used
  // with a pointer, which is both an accessibility failure and the slower way
  // to use it for anybody typing an address in the first place.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setOpen(false); setActive(-1); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hasDropdown) { setOpen(true); return; }
      if (rows.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + rows.length) % rows.length);
      return;
    }
    if (e.key === "Enter" && active >= 0 && active < rows.length) {
      e.preventDefault();
      rows[active].go();
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelectorAll("[data-row]")[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // The room below the field changes as the page scrolls or the window resizes,
  // and on a phone when the on-screen keyboard opens. Remeasured while the
  // panel is up so it never ends up hanging off the bottom of the screen.
  useEffect(() => {
    if (!hasDropdown) return;
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDropdown, measure]);

  const rowCls = (i: number) =>
    cn(
      "flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-white/[0.04] last:border-0 transition-colors",
      i === active ? "bg-[#c9a84c]/[0.10]" : "hover:bg-[#c9a84c]/[0.06]",
    );

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
        {loading
          ? <Loader2 size={14} className="text-[#c9a84c] animate-spin" />
          : icon ?? <MapPin size={14} className="text-[#c9a84c]" />}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => { measure(); setOpen(true); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder={placeholder}
        className={cn("input-luxury w-full pl-10 pr-4 py-4 rounded-xl", className)}
        autoComplete="off"
        role="combobox"
        aria-expanded={hasDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />

      <AnimatePresence>
        {hasDropdown && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: place.up ? 6 : -6, scale: 0.985 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: place.up ? 4 : -4, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            // Pressing anywhere in the panel must not take focus off the
            // input, because losing focus closes the panel. Without this,
            // grabbing the scrollbar to scroll the list shuts the list.
            // The rows use onMouseDown and still fire: this only stops the
            // browser's default focus shift.
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "absolute z-50 w-full bg-[#0e0e0e] border border-white/[0.09] rounded-xl shadow-2xl overflow-hidden",
              place.up ? "bottom-full mb-1.5" : "top-full mt-1.5",
            )}
          >
            {/* Fixed-price zones, while the field is still near-empty */}
            {showZones && quickZones && (
              <>
                <Header icon={<Navigation size={10} className="text-[#c9a84c]/60" />} text="Fixed-price zones" />
                <ul ref={listRef} id={listId} role="listbox" className={LIST_CLS} style={{ maxHeight: place.maxH }}>
                  {quickZones.map((z, i) => (
                    <li
                      key={z.address + i}
                      data-row
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={() => selectZone(z)}
                      className={rowCls(i)}
                    >
                      <ZoneIcon type={z.icon} />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{z.label}</p>
                        {z.sublabel && <p className="text-[11px] text-white/35 truncate">{z.sublabel}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                <Footer text="Or type any address — you get an instant price" />
              </>
            )}

            {/* Somewhere they have been before, which is usually where they are going */}
            {showRecents && (
              <>
                <Header icon={<Clock3 size={10} className="text-[#c9a84c]/60" />} text="Recent" />
                <ul ref={listRef} id={listId} role="listbox" className={LIST_CLS} style={{ maxHeight: place.maxH }}>
                  {recents.map((r, i) => (
                    <li
                      key={r.label}
                      data-row
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={() => selectRecent(r)}
                      className={rowCls(i)}
                    >
                      <KindIcon kind={r.kind} className="text-[#c9a84c] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{r.name ?? r.label}</p>
                        {r.context && <p className="text-[11px] text-white/35 truncate">{r.context}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Results */}
            {!showZones && !showRecents && suggestions.length > 0 && (
              <ul ref={listRef} id={listId} role="listbox" className={LIST_CLS} style={{ maxHeight: place.maxH }}>
                {suggestions.map((s, i) => (
                  <li
                    key={s.id ?? `${s.lat},${s.lng},${i}`}
                    data-row
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={() => select(s)}
                    className={rowCls(i)}
                  >
                    <KindIcon kind={s.kind} className="text-[#c9a84c] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/85 truncate">
                        <Highlight text={s.name ?? s.label} query={query} />
                      </p>
                      {s.context && <p className="text-[11px] text-white/35 truncate">{s.context}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* A shape the size of the answer, rather than a spinner over nothing */}
            {!showZones && !showRecents && loading && suggestions.length === 0 && (
              <ul className="px-4 py-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                    <span className="w-3.5 h-3.5 rounded bg-white/[0.07] animate-pulse flex-shrink-0" />
                    <span className="flex-1 space-y-1.5">
                      <span className="block h-2.5 rounded bg-white/[0.07] animate-pulse" style={{ width: `${70 - i * 12}%` }} />
                      <span className="block h-2 rounded bg-white/[0.05] animate-pulse" style={{ width: `${45 - i * 8}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Nothing found. Say what to try, and that typing it still works. */}
            {!showZones && !showRecents && !loading && noResults && (
              <div className="px-4 py-3.5">
                <p className="text-sm text-white/70">Nothing found for &ldquo;{query.trim()}&rdquo;</p>
                <p className="text-[11px] text-white/35 mt-1 leading-relaxed">
                  Try the town, the hotel name or the airport terminal. You can also leave it as typed and we will still price the journey.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
      {icon}
      <span className="text-[10px] text-[#c9a84c]/70 uppercase tracking-[0.2em] font-semibold">{text}</span>
    </div>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <div className="px-4 py-2.5 border-t border-white/[0.06]">
      <p className="text-[11px] text-white/25">{text}</p>
    </div>
  );
}
