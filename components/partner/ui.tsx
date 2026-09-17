"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

/**
 * The partner panel's vocabulary. One radius system: 16px for panels, 8px
 * for controls. One accent: gold. Figures set in the display serif on
 * hairlines, never in stat cards.
 */

export const vehicleLabel = (cls: string) => cls.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function euro(n: number | null | undefined) {
  return `€${(n ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function whenParts(iso: string) {
  const d = new Date(iso);
  return {
    day:  d.toLocaleDateString("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }),
  };
}

/** Page heading: a serif title with an optional line under it. */
export function PageTitle({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[34px] leading-none text-white sm:text-[40px]">{title}</h1>
        {sub && <p className="mt-2 text-sm text-dark-400">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

/** A row of figures separated by hairlines. Not cards. */
export function Figures({ items }: { items: { label: string; value: string; note?: string; tone?: "gold" | "white" | "green" }[] }) {
  return (
    <div className="grid grid-cols-2 divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.02] sm:grid-cols-4 sm:divide-x">
      {items.map((f, i) => (
        <div key={f.label} className={`px-5 py-4 ${i >= 2 ? "border-t border-white/[0.08] sm:border-t-0" : ""} ${i % 2 === 1 ? "border-l border-white/[0.08] sm:border-l-0" : ""}`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-dark-500">{f.label}</p>
          <p className={`mt-1.5 font-display text-[26px] leading-none tabular-nums ${f.tone === "gold" ? "text-gold-400" : f.tone === "green" ? "text-emerald-300" : "text-white"}`}>{f.value}</p>
          {f.note && <p className="mt-1.5 text-[11px] text-dark-500">{f.note}</p>}
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED:       { label: "Needs a driver", cls: "border-gold-500/40 text-gold-300 bg-gold-500/10" },
  DRIVER_ASSIGNED: { label: "Dispatched",     cls: "border-sky-500/30 text-sky-300 bg-sky-500/10" },
  IN_PROGRESS:     { label: "On the road",    cls: "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" },
  COMPLETED:       { label: "Completed",      cls: "border-white/10 text-dark-300 bg-white/[0.03]" },
  CANCELLED:       { label: "Cancelled",      cls: "border-red-500/30 text-red-300 bg-red-500/10" },
  REFUNDED:        { label: "Refunded",       cls: "border-red-500/30 text-red-300 bg-red-500/10" },
  PENDING:         { label: "Pending",        cls: "border-white/10 text-dark-300 bg-white/[0.03]" },
};

export function Status({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "border-white/10 text-dark-300" };
  return <span className={`inline-flex h-6 items-center rounded-lg border px-2 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}

/** Skeleton rows the same height as the real ones, so nothing jumps. */
export function Skeleton({ rows = 3, h = 72 }: { rows?: number; h?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: h }} className="animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]" />
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.1] px-6 py-12 text-center">
      <p className="font-display text-xl text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-dark-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const field = "h-11 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-sm text-white placeholder:text-dark-500 outline-none transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15";
export const label = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.15em] text-dark-400";
export const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gold-500 px-5 text-sm font-semibold text-black transition-[transform,background-color] hover:bg-gold-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
export const ghost = "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.1] px-4 text-sm text-dark-200 transition-colors hover:border-white/20 hover:text-white active:scale-[0.98] disabled:opacity-40";

/**
 * A sheet that slides in from the right. Used for everything that is a
 * single decision: dispatching a job, adding a driver, requesting money.
 * Motion: it enters from the side it was summoned from, and leaves faster
 * than it arrived.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button" aria-label="Close" onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#0f0e0b] shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.8)]"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 40 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
              <h2 className="font-display text-xl text-white">{title}</h2>
              <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.1] text-dark-400 hover:text-white" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
