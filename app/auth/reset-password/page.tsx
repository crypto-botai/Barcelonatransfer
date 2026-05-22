"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  if (!token) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={28} className="text-red-400" />
        </div>
        <h2 className="font-display text-xl text-white mb-2">Invalid Link</h2>
        <p className="text-white/40 text-sm mb-6">This password reset link is missing a token. Please request a new one.</p>
        <Link href="/auth/forgot-password" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
          Request New Link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Something went wrong");
      }
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={28} className="text-emerald-400" />
        </div>
        <h2 className="font-display text-xl text-white mb-2">Password Updated</h2>
        <p className="text-white/40 text-sm mb-6">Your password has been changed. Redirecting you to sign in…</p>
        <Link href="/auth/login" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
          Sign In Now
        </Link>
      </motion.div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl text-white mb-1">New Password</h1>
      <p className="text-white/35 text-sm mb-7">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] text-white/30 uppercase tracking-[0.12em] block mb-1.5">New Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c9a84c]/50" />
            <input
              required type={showPw ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className="input-luxury w-full pl-10 pr-11 py-3.5 rounded-xl text-sm"
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/30 uppercase tracking-[0.12em] block mb-1.5">Confirm Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c9a84c]/50" />
            <input
              required type={showCf ? "text" : "password"} value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              className="input-luxury w-full pl-10 pr-11 py-3.5 rounded-xl text-sm"
            />
            <button type="button" onClick={() => setShowCf(!showCf)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
              {showCf ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="btn-gold w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Updating…" : "Set New Password"}
        </button>
      </form>

      <Link href="/auth/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-white/30 hover:text-white/60 transition-colors">
        Back to Sign In
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
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

          <Suspense fallback={<div className="text-white/40 text-sm">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </motion.div>
    </main>
  );
}
