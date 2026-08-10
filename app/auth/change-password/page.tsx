"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const mustChange = (session?.user as { mustChangePassword?: boolean })?.mustChangePassword;

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    // Redirect away if no active session
    if (session === null) router.replace("/auth/login");
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword:     newPw,
          currentPassword: mustChange ? undefined : currentPw,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update password");

      // Refresh JWT so mustChangePassword flag is cleared
      await update();
      setDone(true);
      // Straight to their own portal. Drivers sent to /dashboard would only be
      // bounced onward by the middleware.
      const role = (session?.user as { role?: string })?.role;
      const home = role === "ADMIN" ? "/admin" : role === "DRIVER" ? "/driver" : "/dashboard";
      setTimeout(() => router.replace(home), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <p className="text-white font-semibold">Password updated!</p>
          <p className="text-dark-400 text-sm mt-1">Redirecting to your dashboard…</p>
        </motion.div>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 max-w-sm w-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <Lock size={18} className="text-gold-400" />
            </div>
            <div>
              <h1 className="font-display text-xl text-white">
                {mustChange ? "Set Your Password" : "Change Password"}
              </h1>
              {mustChange && (
                <p className="text-xs text-dark-400 mt-0.5">Please set a personal password for your account.</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!mustChange && (
              <div>
                <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    required
                    className="input-luxury w-full pr-10"
                    placeholder="Your current password"
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  minLength={8}
                  className="input-luxury w-full pr-10"
                  placeholder="Min. 8 characters"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                className="input-luxury w-full"
                placeholder="Repeat new password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {loading ? "Saving…" : "Save Password"}
            </button>

            {mustChange && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-center text-xs text-dark-500 hover:text-dark-300 transition-colors py-2"
              >
                Sign out instead
              </button>
            )}
          </form>
        </motion.div>
      </main>
    </>
  );
}
