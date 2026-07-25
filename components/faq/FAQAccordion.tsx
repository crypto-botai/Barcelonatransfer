"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_GROUPS } from "@/lib/faq-data";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 px-0 text-left group"
        aria-expanded={open}
      >
        <span className="text-white text-sm font-medium pr-4 group-hover:text-gold-400 transition-colors">
          {q}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-gold-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="text-dark-400 text-sm leading-relaxed pb-5">{a}</p>
      )}
    </div>
  );
}

export default function FAQAccordion() {
  return (
    <div className="space-y-10">
      {FAQ_GROUPS.map((group) => (
        <div key={group.group}>
          <h2 className="text-gold-500 text-xs tracking-[0.25em] uppercase font-medium mb-4">
            {group.group}
          </h2>
          <div className="glass-card rounded-2xl px-6">
            {group.items.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
