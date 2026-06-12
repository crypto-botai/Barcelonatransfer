"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ContactFormClient() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Message sent! We'll reply within 2 hours.");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      toast.error("Could not send message. Please try WhatsApp or email directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-8">
      <h2 className="font-display text-2xl text-white mb-6">Send a Message</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Name</label>
            <input required type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name"
              className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Phone</label>
            <input type="tel" value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+34..."
              className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email</label>
          <input required type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="your@email.com"
            className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
        </div>
        <div>
          <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Message</label>
          <textarea required rows={5} value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="How can we help you?"
            className="input-luxury w-full px-4 py-3 rounded-xl text-sm resize-none" />
        </div>
        <button type="submit" disabled={loading}
          className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? "Sending…" : "Send Message"}
        </button>
      </form>
    </div>
  );
}
