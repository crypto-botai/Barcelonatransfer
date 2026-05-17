"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Phone } from "lucide-react";

export default function WhatsAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="glass-card rounded-2xl p-5 w-72 shadow-luxury mb-2"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
                <MessageCircle size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Élite BCN Support</p>
                <p className="text-green-400 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Online — Typically replies instantly
                </p>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 mb-4">
              <p className="text-dark-300 text-sm leading-relaxed">
                Hello! 👋 How can we help you today? Book a luxury transfer or get an instant quote.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="https://wa.me/34635383712?text=Hello%2C%20I%20would%20like%20to%20book%20a%20luxury%20transfer."
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe5c] transition-colors"
              >
                <MessageCircle size={16} />
                Start WhatsApp Chat
              </a>
              <a
                href="tel:+34635383712"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 text-dark-300 text-sm hover:text-white hover:border-white/20 transition-colors"
              >
                <Phone size={14} />
                Call +34 635 383 712
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-14 h-14 rounded-full bg-[#25D366] shadow-[0_4px_24px_rgba(37,211,102,0.4)] flex items-center justify-center text-white hover:bg-[#1ebe5c] transition-colors"
        aria-label="WhatsApp"
      >
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0a0a0a] flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">1</span>
          </span>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={open ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X size={22} /> : <MessageCircle size={22} />}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
