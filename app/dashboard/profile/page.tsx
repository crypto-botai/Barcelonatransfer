"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Phone, Lock, Shield, Bell, Globe, Save, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user as { id?: string; name?: string; email?: string; image?: string } | undefined;
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to save");
      }
      await update({ name });
      setSaved(true);
      toast.success("Profile updated successfully");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 border border-white/[0.06] flex items-center gap-5"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center text-gold-400 text-2xl font-bold overflow-hidden">
            {user?.image ? (
              <img src={user.image} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0]?.toUpperCase() ?? "U"
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#050505] flex items-center justify-center">
            <Check size={10} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-white font-semibold text-lg">{user?.name ?? "Guest"}</p>
          <p className="text-dark-400 text-sm">{user?.email}</p>
          <p className="text-gold-400 text-xs mt-1 flex items-center gap-1">
            <Shield size={10} /> Verified account
          </p>
        </div>
      </motion.div>

      {/* Personal info */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06] space-y-4">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Personal Information</h3>
        <div className="space-y-3">
          <div>
            <label className="text-dark-400 text-xs uppercase tracking-widest block mb-1.5">Full Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-luxury w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                placeholder="Your full name"
              />
            </div>
          </div>
          <div>
            <label className="text-dark-400 text-xs uppercase tracking-widest block mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                value={user?.email ?? ""}
                disabled
                className="input-luxury w-full pl-9 pr-4 py-3 rounded-xl text-sm opacity-50 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="text-dark-400 text-xs uppercase tracking-widest block mb-1.5">Phone Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input-luxury w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                placeholder="+34 600 000 000"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${saved ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "btn-gold"}`}
        >
          {saving ? <div className="w-4 h-4 border-2 border-dark-950/30 border-t-dark-950 rounded-full animate-spin" /> : saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
        </button>
      </div>

      {/* Preferences */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06] space-y-4">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Preferences</h3>
        <div className="space-y-3">
          {[
            { icon: Bell, label: "Email notifications", sub: "Booking confirmations, updates", enabled: true },
            { icon: Bell, label: "SMS notifications",   sub: "Driver arrival alerts",           enabled: false },
            { icon: Globe, label: "Language",           sub: "English (UK)",                   enabled: null },
          ].map(({ icon: Icon, label, sub, enabled }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-3">
                <Icon size={15} className="text-dark-400" />
                <div>
                  <p className="text-white text-sm">{label}</p>
                  <p className="text-dark-500 text-xs">{sub}</p>
                </div>
              </div>
              {enabled !== null ? (
                <button
                  className={`w-10 h-5.5 rounded-full transition-all relative ${enabled ? "bg-gold-500" : "bg-dark-700"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-5.5" : "left-0.5"}`} />
                </button>
              ) : (
                <span className="text-dark-400 text-xs">English</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06] space-y-3">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Security</h3>
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-dark-800 border border-white/[0.06] hover:border-white/[0.1] transition-all group">
          <div className="flex items-center gap-3">
            <Lock size={15} className="text-dark-400 group-hover:text-gold-500 transition-colors" />
            <div className="text-left">
              <p className="text-white text-sm">Change Password</p>
              <p className="text-dark-500 text-xs">Last changed 30 days ago</p>
            </div>
          </div>
          <Shield size={14} className="text-dark-500 group-hover:text-gold-500 transition-colors" />
        </button>
      </div>
    </div>
  );
}
