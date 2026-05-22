"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Something went wrong");
      }
      setSent(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="bg-[#0c0c0c] border border-white/[0.07] rounded-2xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.8)]">

          <Link href="/" className="flex items-center gap-2.5 mb-8 w-fit group">
            <div className="w-8 h-8 border border-[#c9a84c] rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#c9a84c]" />
            </div>
            <span className="font-display text-xl tracking-[0.25em]">
              <span className="text-white">ÉLITE</span><span className="text-[#c9a84c]">BCN</span>
            </span>
          </Link>

          {sent ? (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <h2 className="font-display text-xl text-white mb-2">Check your inbox</h2>
              <p className="text-white/40 text-sm leading-relaxed mb-6">
                We sent a password reset link to <span className="text-white/70">{email}</span>. The link expires in 1 hour.
              </p>
              <p className="text-white/25 text-xs mb-6">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button onClick={() => setSent(false)} className="text-[#c9a84c] hover:text-[#e4c97e] transition-colors">
                  try again
                </button>.
              </p>
              <Link href="/auth/login" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
                Back to Sign In
              </Link>
            </motion.div>
          ) : (
            <>
              <h1 className="font-display text-2xl text-white mb-1">Reset Password</h1>
              <p className="text-white/35 text-sm mb-7">Enter your email and we&apos;ll send you a secure reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[11px] text-white/30 uppercase tracking-[0.12em] block mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c9a84c]/50" />
                    <input
                      required type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      className="input-luxury w-full pl-10 pr-4 py-3.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="btn-gold w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <Link href="/auth/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-white/30 hover:text-white/60 transition-colors">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </main>
  );
}
