"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Phone } from "lucide-react";

const WA_NUMBER = "34635383712";
const WA_TEXT = "Hello, I would like to book a private transfer.";

/**
 * The only floating support control on the site.
 *
 * It replaced the support centre, which offered an AI concierge alongside
 * WhatsApp. The owner asked for WhatsApp alone: it is the channel their
 * customers in Spain actually use, and the one they answer themselves.
 *
 * No framer-motion here. That library was taken off the homepage's critical
 * path deliberately, and a floating button that appears on every page would
 * have pulled it straight back in for two fades.
 */
export default function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    // Sits clear of the mobile price bar on the booking form, and drops to the
    // corner once there is room for it.
    <div ref={ref} className="fixed bottom-20 right-6 lg:bottom-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="animate-menu-in glass-card rounded-2xl p-5 w-72 shadow-luxury">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
              <MessageCircle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold">Elite BCN Support</p>
              <p className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Usually replies within minutes
              </p>
            </div>
          </div>

          <div className="bg-black/30 rounded-xl p-3 mb-4">
            <p className="text-dark-300 text-sm leading-relaxed">
              Hello. Message us for a price, to book a transfer, or with any question
              about a booking you already have.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ touchAction: "manipulation" }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe5c] transition-colors"
            >
              <MessageCircle size={16} />
              Start WhatsApp chat
            </a>
            <a
              href={`tel:+${WA_NUMBER}`}
              style={{ touchAction: "manipulation" }}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-dark-300 text-sm hover:text-white hover:border-white/20 transition-colors"
            >
              <Phone size={14} />
              Call +34 635 383 712
            </a>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{ touchAction: "manipulation" }}
        className="relative w-14 h-14 rounded-full bg-[#25D366] shadow-[0_4px_24px_rgba(37,211,102,0.4)] flex items-center justify-center text-white hover:bg-[#1ebe5c] hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label={open ? "Close WhatsApp panel" : "Contact us on WhatsApp"}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
