"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { EarningsBucket, EarningsSeries, EarningsView } from "@/lib/partner-earnings";
import { euro } from "./ui";

/**
 * Daily, weekly and monthly earnings.
 *
 * One chart, three zoom levels. The bars grow from the baseline once when the
 * data arrives, which is the only unprompted motion on the panel: it shows the
 * figures are live rather than painted on. Choosing a bar, or moving along the
 * row of bars with the arrow keys, fills in the line underneath with what that
 * period was.
 */

const VIEWS: { id: EarningsView; label: string; noun: string }[] = [
  { id: "day", label: "Daily", noun: "14 days" },
  { id: "week", label: "Weekly", noun: "8 weeks" },
  { id: "month", label: "Monthly", noun: "6 months" },
];

const tidy = (n: number) => (n >= 1000 ? `€${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `€${Math.round(n)}`);

export default function EarningsPanel({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<EarningsView>("day");
  const [data, setData] = useState<EarningsSeries | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let alive = true;
    setData(null); setFailed(false); setPicked(null);
    fetch(`/api/partner/earnings?view=${view}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: EarningsSeries) => { if (alive) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [view]);

  const max = useMemo(() => Math.max(1, ...(data?.buckets.map((b) => b.earned) ?? [1])), [data]);
  const focus: EarningsBucket | null = data ? data.buckets.find((b) => b.key === picked) ?? data.buckets.find((b) => b.current) ?? null : null;
  const noun = VIEWS.find((v) => v.id === view)!.noun;

  return (
    <section aria-label="Earnings" className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-1 pt-5 sm:px-6">
        <div>
          <p className="text-[11px] text-dark-500">Earned over the last {noun}</p>
          <p className="mt-1.5 font-display text-[40px] leading-none text-gold-400 tabular-nums sm:text-[46px]">{data ? euro(data.totals.earned) : " "}</p>
          {data && (
            <p className="mt-2 text-xs text-dark-400">
              {data.totals.rides} completed ride{data.totals.rides === 1 ? "" : "s"}
              {data.totals.toDrivers > 0 && <> · drivers {euro(data.totals.toDrivers)} · you keep <span className="text-gold-500/90">{euro(data.totals.kept)}</span></>}
            </p>
          )}
        </div>

        <div className="relative grid grid-cols-3 rounded-lg border border-white/[0.1] bg-white/[0.03] p-0.5" role="tablist" aria-label="Period">
          {VIEWS.map((v) => {
            const on = v.id === view;
            return (
              <button
                key={v.id} role="tab" aria-selected={on} onClick={() => setView(v.id)}
                className={`relative h-9 px-3.5 text-[13px] transition-colors ${on ? "text-black" : "text-dark-300 hover:text-white"}`}
              >
                {on && <motion.span layoutId={`earn-view-${compact ? "c" : "f"}`} className="absolute inset-0 rounded-md bg-gold-500" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} />}
                <span className="relative font-medium">{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-2 pt-5 sm:px-5">
        {failed ? (
          <p className="px-3 py-14 text-center text-sm text-red-300">Could not load your earnings. Refresh to try again.</p>
        ) : !data ? (
          <div className="flex h-[188px] items-end gap-1.5 px-2" aria-busy="true" aria-label="Loading earnings">
            {Array.from({ length: 14 }).map((_, i) => <div key={i} style={{ height: `${28 + ((i * 37) % 55)}%` }} className="flex-1 animate-pulse rounded-t bg-white/[0.05]" />)}
          </div>
        ) : data.totals.rides === 0 ? (
          <div className="grid h-[188px] place-items-center px-6 text-center">
            <div>
              <p className="font-display text-xl text-white">Nothing earned in this period yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-dark-400">A ride earns its payout when it is marked completed. It then appears here on the day it ended.</p>
            </div>
          </div>
        ) : (
          <div role="group" aria-label={`Earnings by ${view}`} className="relative">
            {/* The ceiling, so the bars have a scale. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-dark-500">{tidy(max)}</span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <div className="flex h-[188px] items-end gap-1 pt-5 sm:gap-1.5">
              {data.buckets.map((b, i) => {
                const h = b.earned > 0 ? Math.max(4, (b.earned / max) * 100) : 0;
                const on = focus?.key === b.key;
                return (
                  <button
                    key={b.key} type="button"
                    onClick={() => setPicked(b.key)} onFocus={() => setPicked(b.key)} onMouseEnter={() => setPicked(b.key)}
                    aria-label={`${b.title}: ${euro(b.earned)}, ${b.rides} ride${b.rides === 1 ? "" : "s"}`}
                    aria-pressed={on}
                    className="group relative flex h-full min-w-0 flex-1 items-end rounded-t focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500/70"
                  >
                    <motion.span
                      aria-hidden
                      initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.55, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: `${h}%`, transformOrigin: "bottom" }}
                      className={`block w-full rounded-t-[5px] transition-colors ${
                        b.earned === 0 ? "border-t border-dashed border-white/[0.12]"
                          : on ? "bg-gold-400"
                          : b.current ? "bg-gold-500/80"
                          : "bg-gold-500/35 group-hover:bg-gold-500/55"
                      }`}
                    />
                    {b.earned === 0 && <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/[0.12]" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1 sm:gap-1.5" aria-hidden>
              {data.buckets.map((b, i) => {
                // Name every bar on a week or month, thin a day view to every other one on a phone.
                const showOnPhone = view !== "day" || i % 2 === 0 || b.current;
                return (
                  <span key={b.key} className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums ${b.current ? "text-gold-300" : "text-dark-500"} ${showOnPhone ? "" : "max-sm:invisible"}`}>
                    {b.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* What the chosen bar was. A fixed height, so choosing one never moves the page. */}
      <div className="min-h-[3.5rem] border-t border-white/[0.06] px-5 py-3.5 text-sm sm:px-6" aria-live="polite">
        {focus && data && data.totals.rides > 0 ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-white">{focus.title}{focus.current && <span className="ml-2 text-xs text-gold-400">now</span>}</p>
            <p className="tabular-nums text-dark-300">
              <span className="font-display text-lg text-gold-400">{euro(focus.earned)}</span>
              <span className="mx-2 text-dark-600">·</span>{focus.rides} ride{focus.rides === 1 ? "" : "s"}
              {focus.toDrivers > 0 && <><span className="mx-2 text-dark-600">·</span>drivers {euro(focus.toDrivers)}<span className="mx-2 text-dark-600">·</span>you keep {euro(focus.kept)}</>}
            </p>
          </div>
        ) : (
          <p className="text-dark-500">Choose a bar to see that period.</p>
        )}
      </div>

      {!compact && data && data.totals.rides > 0 && (
        <div className="overflow-x-auto border-t border-white/[0.06]">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">Earnings by {view}</caption>
            <thead>
              <tr className="text-left text-[11px] text-dark-500">
                <th scope="col" className="px-5 py-3 font-medium sm:px-6">{view === "day" ? "Day" : view === "week" ? "Week" : "Month"}</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Rides</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Earned</th>
                <th scope="col" className="px-3 py-3 text-right font-medium">Drivers</th>
                <th scope="col" className="px-5 py-3 text-right font-medium sm:px-6">You keep</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {[...data.buckets].reverse().map((b) => (
                <tr key={b.key} className={b.rides === 0 ? "text-dark-600" : "text-dark-200"}>
                  <th scope="row" className="px-5 py-2.5 text-left font-normal sm:px-6">{b.title}{b.current && <span className="ml-2 text-xs text-gold-400">now</span>}</th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{b.rides}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{b.rides ? euro(b.earned) : "none"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{b.rides && b.toDrivers ? euro(b.toDrivers) : "none"}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-gold-400 sm:px-6">{b.rides ? euro(b.kept) : "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
