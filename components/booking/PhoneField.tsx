"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Phone, Search, ChevronDown, Check } from "lucide-react";
import {
  DIAL_CODES,
  dialCodeFor,
  flagFor,
  guessIsoFromBrowser,
  isUsablePhone,
  searchDialCodes,
  splitE164,
  toE164,
} from "@/lib/dial-codes";

/**
 * Phone number with an explicit country, stored in E.164.
 *
 * The booking form asked for a phone number with a bare <input type="tel"> and
 * accepted anything non-empty. Guests typed their number the way they say it at
 * home — "612345678", "07700 900123" — and the dispatcher was left holding a
 * string with no country. On an airport pickup, a driver who cannot reach the
 * passenger is the most expensive failure this business has: the fare is gone
 * and so is the review.
 *
 * The country now has to be chosen, and what gets stored is "+34612345678":
 * unambiguous, dialable from the admin panel, and valid in a WhatsApp link.
 *
 * The list is searchable because scrolling 140 countries on a phone to reach
 * Uruguay is its own reason to abandon a booking, and it is scrollable because
 * search only helps people who know what to type.
 */
export default function PhoneField({
  value,
  onChange,
  placeholder,
  label = "Phone",
  required = true,
}: {
  /** E.164, e.g. "+34612345678". Empty string when unset. */
  value: string;
  onChange: (e164: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}) {
  const initial = useMemo(() => splitE164(value || ""), [/* first render only */]); // eslint-disable-line react-hooks/exhaustive-deps
  const [iso, setIso] = useState<string>(initial.iso ?? "ES");
  const [national, setNational] = useState<string>(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // The browser already knows where the guest is; it is right far more often
  // than any fixed default. Only applied when they have not chosen yet.
  useEffect(() => {
    if (initial.iso) return;
    const guess = guessIsoFromBrowser();
    if (guess) setIso(guess);
  }, [initial.iso]);

  // Push E.164 upward whenever either half changes.
  useEffect(() => {
    onChange(national.trim() ? toE164(iso, national) : "");
    // onChange identity is not stable in the parent; depending on it loops.
  }, [iso, national]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    // Focus search on open so a keyboard user can type straight away.
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const results = useMemo(() => searchDialCodes(query), [query]);
  const current = dialCodeFor(iso);
  const valid = isUsablePhone(iso, national);
  const showError = required && touched && national.trim().length > 0 && !valid;

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
        {label} {required && "*"}
      </label>

      <div className="flex gap-2">
        {/* Country selector */}
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setQuery(""); }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Country code: ${current ? `${current.name} +${current.dial}` : "select"}`}
          className="input-luxury flex items-center gap-1.5 px-3 py-4 rounded-xl text-sm flex-shrink-0 hover:border-gold-500/40 transition-colors"
        >
          <span className="text-base leading-none">{flagFor(iso)}</span>
          <span className="text-white tabular-nums">+{current?.dial ?? "—"}</span>
          <ChevronDown size={13} className={`text-gold-500/70 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* National number */}
        <div className="relative flex-1">
          <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
          <input
            required={required}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={national}
            onChange={(e) => setNational(e.target.value.replace(/[^\d\s()\-.]/g, ""))}
            onBlur={() => setTouched(true)}
            placeholder={placeholder ?? "612 345 678"}
            aria-invalid={showError || undefined}
            className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl text-sm"
          />
        </div>
      </div>

      {showError && (
        <p className="text-[11px] text-red-400/90 mt-1.5">
          That does not look like a complete number — check the country and try again.
        </p>
      )}
      {!showError && (
        <p className="text-[11px] text-dark-500 mt-1.5">
          Your driver calls this number on the day. Include it without the leading zero.
        </p>
      )}

      {/* Dropdown: search first, then a scrollable list */}
      {open && (
        <div className="absolute z-50 mt-2 w-full sm:w-80 rounded-xl border border-white/[0.1] bg-dark-900 shadow-2xl overflow-hidden">
          <div className="relative border-b border-white/[0.08]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              aria-label="Search country or dialling code"
              className="w-full bg-transparent pl-9 pr-3 py-3 text-sm text-white placeholder:text-dark-500 outline-none"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-4 py-3 text-sm text-dark-400">No country matches that.</li>
            )}
            {results.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso === iso}
                  onClick={() => { setIso(c.iso); setOpen(false); setQuery(""); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                    c.iso === iso ? "bg-gold-500/10 text-gold-400" : "text-dark-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-base leading-none">{flagFor(c.iso)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-dark-400 tabular-nums">+{c.dial}</span>
                  {c.iso === iso && <Check size={13} className="text-gold-500 flex-shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          <p className="px-3.5 py-2 text-[10px] text-dark-500 border-t border-white/[0.06]">
            {DIAL_CODES.length} countries — type to filter
          </p>
        </div>
      )}
    </div>
  );
}
