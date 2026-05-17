"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";
import { Mail, Phone, MessageCircle, MapPin, Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    toast.success("Message sent! We'll reply within 2 hours.");
    setForm({ name: "", email: "", phone: "", message: "" });
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="py-20 bg-[#050505] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <span className="inline-block text-gold-500 text-xs tracking-[0.3em] uppercase font-medium mb-4">Contact</span>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Get in <span className="text-gold-gradient">Touch</span>
            </h1>
            <p className="text-dark-400 max-w-xl mx-auto">
              Available 24/7 for bookings, inquiries, and corporate accounts.
            </p>
          </div>
        </section>

        <section className="py-16 bg-dark-950">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
              {/* Contact info */}
              <div>
                <h2 className="font-display text-3xl text-white mb-8">We&apos;re Here to Help</h2>
                <div className="space-y-5">
                  {[
                    { icon: Phone,         label: "Phone",     value: "+34 635 383 712",     href: "tel:+34635383712" },
                    { icon: Mail,          label: "Email",     value: "vtcbcn2025@gmail.com", href: "mailto:vtcbcn2025@gmail.com" },
                    { icon: MessageCircle, label: "WhatsApp",  value: "Chat with us now",     href: "https://wa.me/34635383712" },
                    { icon: MapPin,        label: "Location",  value: "Barcelona, Spain",     href: "#" },
                  ].map((c) => (
                    <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
                      className="flex items-center gap-4 p-4 rounded-xl glass-card gold-hover-border group">
                      <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center">
                        <c.icon size={18} className="text-gold-500" />
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs tracking-wider uppercase">{c.label}</p>
                        <p className="text-white text-sm font-medium group-hover:text-gold-400 transition-colors">{c.value}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Form */}
              <div className="glass-card rounded-2xl p-8">
                <h2 className="font-display text-2xl text-white mb-6">Send a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Name</label>
                      <input required type="text" value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your name" className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Phone</label>
                      <input type="tel" value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+34..." className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email</label>
                    <input required type="email" value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com" className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
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
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
