"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      toast.success("Account created! Please sign in.");
      router.push("/auth/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.06),transparent)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative z-10"
      >
        <Link href="/" className="flex items-center gap-2 mb-8 w-fit">
          <div className="w-8 h-8 border border-gold-500 rotate-45 flex items-center justify-center">
            <div className="w-3 h-3 bg-gold-500" />
          </div>
          <span className="font-display text-xl tracking-[0.25em]">
            <span className="text-white">ÉLITE</span><span className="text-gold-500">BCN</span>
          </span>
        </Link>

        <h1 className="font-display text-2xl text-white mb-2">Create Account</h1>
        <p className="text-dark-400 text-sm mb-7">Manage bookings, view history, and enjoy faster checkout.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { icon: User,  key: "name",     type: "text",     ph: "Full name" },
            { icon: Mail,  key: "email",    type: "email",    ph: "your@email.com" },
            { icon: Phone, key: "phone",    type: "tel",      ph: "+34 600 000 000" },
            { icon: Lock,  key: "password", type: "password", ph: "Minimum 8 characters" },
          ].map(({ icon: Icon, key, type, ph }) => (
            <div key={key}>
              <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5 capitalize">{key}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                <input required type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl" />
              </div>
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="btn-gold w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Creating Account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 transition-colors">Sign In</Link>
        </p>
      </motion.div>
    </main>
  );
}
