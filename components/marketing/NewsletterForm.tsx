"use client";

import { useState } from "react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";

export default function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [email,     setEmail]     = useState("");
  const [name,      setName]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, source }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={16} className="text-green-400" />
        </div>
        <div>
          <p className="text-sm text-white font-medium">You&apos;re subscribed!</p>
          <p className="text-xs text-dark-400">Welcome to the Élite BCN community.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/60 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs placeholder-dark-500 focus:outline-none focus:border-gold-500/40 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-lg bg-gold-500 text-black text-xs font-semibold hover:bg-gold-400 transition-colors disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : null}
          {loading ? "…" : "Subscribe"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <p className="text-dark-600 text-[10px]">No spam. Exclusive deals & Barcelona travel tips. Unsubscribe anytime.</p>
    </form>
  );
}
