"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Tag } from "lucide-react";
import type { Conversation } from "@/lib/whatsapp-inbox";
import { MANUAL_TAGS, MANUAL_TAG_HINTS, TAG_LABELS, type PaymentTag } from "@/lib/whatsapp-tags";
import { cn } from "@/lib/utils";
import { TagPill } from "./ConversationList";

/**
 * Where the customer's money stands, chosen by the office.
 *
 * The chat shows a tag by itself when the customer's number matches a booking.
 * This is for everything the booking cannot know: a cash deal agreed in the
 * chat, a bank transfer that arrived, a 30% deposit taken by phone. Choosing
 * one overrides the booking's; "Automatic" hands it back.
 */
export default function TagPicker({ conv, onChoose }: { conv: Conversation | null; onChoose: (tag: PaymentTag | "auto") => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const tag = conv?.tag ?? null;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
      if (!items.length) return;
      e.preventDefault();
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", keys);
    // Land on the chosen option so the keyboard starts where the eye is.
    const frame = requestAnimationFrame(() => (root.current?.querySelector<HTMLButtonElement>("[role=menuitemradio][aria-checked=true]") ?? root.current?.querySelector<HTMLButtonElement>("[role=menuitemradio]"))?.focus());
    return () => { cancelAnimationFrame(frame); document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", keys); };
  }, [open]);

  const choose = (t: PaymentTag | "auto") => { setOpen(false); onChoose(t); };
  const chosen = conv?.manualTag ?? null;
  const row = "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={tag ? `Payment tag: ${tag.label}. Change it` : "Add a payment tag"}
        title="Tag this chat: pending payment, 30% paid, cash to chauffeur, paid in full"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500/60",
          tag ? "px-1.5 sm:pl-1.5 sm:pr-2.5" : "w-10 justify-center text-dark-300 hover:text-white sm:w-auto sm:px-3",
        )}
      >
        {tag ? (
          <>
            <TagPill tag={tag.tag} label={tag.label} title={tag.detail ?? undefined} className="max-w-[9.5rem] truncate" />
            <ChevronDown size={14} className={cn("hidden text-dark-400 transition-transform sm:block", open && "rotate-180")} />
          </>
        ) : (
          <>
            <Tag size={17} />
            <span className="hidden sm:inline">Add tag</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Payment tag"
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-30 mt-1.5 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#161616] p-1.5 shadow-2xl shadow-black/60"
          >
            <p className="px-2.5 pb-1.5 pt-1.5 text-[11.5px] text-dark-400">Where does this customer&apos;s payment stand?</p>
            {MANUAL_TAGS.map((t) => (
              <button key={t} type="button" role="menuitemradio" aria-checked={chosen === t} onClick={() => choose(t)} className={row}>
                <span className="min-w-0 flex-1">
                  <TagPill tag={t} label={TAG_LABELS[t]} />
                  <span className="mt-1 block text-[12px] leading-snug text-dark-400">{MANUAL_TAG_HINTS[t]}</span>
                </span>
                {chosen === t && <Check size={16} className="mt-0.5 shrink-0 text-gold-400" />}
              </button>
            ))}
            <div className="my-1 h-px bg-white/[0.07]" />
            <button type="button" role="menuitemradio" aria-checked={chosen === null} onClick={() => choose("auto")} className={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-white">Automatic</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-dark-400">
                  {conv?.booking ? `From booking ${conv.booking.code}: ${conv.booking.label}` : "No booking matches this number, so no tag"}
                </span>
              </span>
              {chosen === null && <Check size={16} className="mt-0.5 shrink-0 text-gold-400" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
