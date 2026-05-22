"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Phone, Mail, ChevronRight, Send, HelpCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

const FAQS = [
  { q: "How do I cancel a booking?",            a: "You can cancel any confirmed booking up to 24 hours before pickup for a full refund. Go to My Bookings, open the booking, and tap Cancel." },
  { q: "Can I change my pickup time?",           a: "Yes — open the booking from My Bookings and tap Edit. Time changes are free up to 4 hours before pickup." },
  { q: "What if my flight is delayed?",          a: "We monitor all airport pickups live. If your flight is delayed, your driver adjusts automatically. No action needed." },
  { q: "How do I get an invoice / receipt?",     a: "Every booking has a PDF invoice available from My Bookings → Invoice button." },
  { q: "Can I request a specific vehicle?",      a: "Yes — select your preferred vehicle class during booking. Availability depends on the route." },
];

export default function SupportPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    setSending(false);
    setMessage("");
    toast.success("Message sent! We'll reply within 30 minutes.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">

      {/* Contact options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: MessageCircle, label: "WhatsApp", sub: "Fastest response", href: "https://wa.me/34635383712", color: "text-[#25D366] bg-[#25D366]/10 border-[#25D366]/20" },
          { icon: Phone, label: "Call Us",   sub: "+34 635 383 712",   href: "tel:+34635383712",            color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
          { icon: Mail,  label: "Email",     sub: "Reply in 2 hours",   href: "mailto:vtcbcn2025@gmail.com", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
        ].map(({ icon: Icon, label, sub, href, color }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="glass-card rounded-2xl p-5 border border-white/[0.06] hover:border-gold-500/20 transition-all group flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-xl border ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-white text-sm font-medium group-hover:text-gold-400 transition-colors">{label}</p>
              <p className="text-dark-400 text-xs">{sub}</p>
            </div>
            <ChevronRight size={14} className="text-dark-600 group-hover:text-gold-500 ml-auto transition-colors" />
          </a>
        ))}
      </div>

      {/* Response time */}
      <div className="glass-card rounded-xl p-4 border border-white/[0.06] flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <Clock size={14} className="text-dark-400" />
        <p className="text-dark-300 text-sm">Support available <strong className="text-white">24/7</strong> · Average response: <strong className="text-white">&lt;15 minutes</strong></p>
      </div>

      {/* Message form */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06] space-y-4">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Send a Message</h3>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          placeholder="Describe your issue or question…"
          className="input-luxury w-full px-4 py-3 rounded-xl text-sm resize-none"
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-gold text-sm font-semibold disabled:opacity-50"
        >
          {sending ? <div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> : <><Send size={14} /> Send Message</>}
        </button>
      </div>

      {/* FAQs */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <HelpCircle size={15} className="text-gold-500" /> Frequently Asked Questions
          </h3>
        </div>
        {FAQS.map((faq, i) => (
          <div key={i} className={`border-b border-white/[0.04] last:border-0`}>
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-start justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-white text-sm font-medium pr-4">{faq.q}</span>
              <ChevronRight
                size={14}
                className={`text-dark-500 flex-shrink-0 mt-0.5 transition-transform ${expanded === i ? "rotate-90" : ""}`}
              />
            </button>
            {expanded === i && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-5 pb-4 overflow-hidden"
              >
                <p className="text-dark-400 text-sm leading-relaxed">{faq.a}</p>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
