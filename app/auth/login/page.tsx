"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = () => {
    setGoogleLoading(true);
    signIn("google", { callbackUrl });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      toast.success("Welcome back!");
      router.push(callbackUrl);
    } else {
      toast.error("Incorrect email or password.");
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(201,168,76,0.07),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-[#0c0c0c] border border-white/[0.07] rounded-2xl p-8 shadow-[0_32px_80px_rgba(0,0,0,0.8)]">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 mb-8 w-fit group">
            <div className="w-8 h-8 border border-[#c9a84c] rotate-45 flex items-center justify-center group-hover:bg-[#c9a84c] transition-colors duration-300">
              <div className="w-3 h-3 bg-[#c9a84c] group-hover:bg-black transition-colors duration-300" />
            </div>
            <span className="font-display text-xl tracking-[0.25em]">
              <span className="text-white">ÉLITE</span><span className="text-[#c9a84c]">BCN</span>
            </span>
          </Link>

          <h1 className="font-display text-2xl text-white mb-1">Welcome Back</h1>
          <p className="text-white/35 text-sm mb-7">Sign in to manage your bookings and account.</p>

          {/* Google — Primary CTA */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-white text-[#0a0a0a] font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 shadow-sm disabled:opacity-70"
          >
            {googleLoading ? <Loader2 size={18} className="animate-spin text-gray-600" /> : <GoogleIcon />}
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Guest link */}
          <Link
            href="/book"
            className="flex items-center justify-center gap-1.5 mt-3 text-sm text-white/30 hover:text-white/60 transition-colors duration-200"
          >
            Continue as guest — Book without account
            <ArrowRight size={13} />
          </Link>

          {/* Divider */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px bg-white/[0.07]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#0c0c0c] text-xs text-white/25 tracking-widest uppercase">or sign in with email</span>
            </div>
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-white/30 uppercase tracking-[0.12em] block mb-1.5">Email</label>
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
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-white/30 uppercase tracking-[0.12em]">Password</label>
                <Link href="/auth/forgot-password" className="text-[11px] text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#c9a84c]/50" />
                <input
                  required type={show ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-luxury w-full pl-10 pr-11 py-3.5 rounded-xl text-sm"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-gold w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 flex flex-col gap-2 text-center">
            <p className="text-sm text-white/30">
              New to Élite BCN?{" "}
              <Link href="/auth/register" className="text-[#c9a84c] hover:text-[#e4c97e] transition-colors font-medium">
                Create account
              </Link>
            </p>
            <p className="text-sm text-white/20">
              Are you a driver?{" "}
              <Link href="/driver/register" className="text-white/35 hover:text-white/60 transition-colors">
                Driver registration
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-white/15 text-xs mt-5 leading-relaxed">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-white/30 transition-colors">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-white/30 transition-colors">Privacy Policy</Link>.
        </p>
      </motion.div>
    </main>
  );
}
