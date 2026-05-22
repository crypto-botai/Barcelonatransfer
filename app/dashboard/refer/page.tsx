"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Check, Share2, Users, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function ReferPage() {
  const { data: session } = useSession();
  const user = session?.user as { id?: string; name?: string; email?: string } | undefined;
  const [copied, setCopied] = useState(false);

  const referralCode = `ELITE-${(user?.id ?? "XXXX").slice(-6).toUpperCase()}`;
  const referralLink = `https://www.elitebcn.info/book?ref=${referralCode}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-dark-800 to-dark-900 border border-gold-500/20 p-6 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.1),transparent)]" />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto mb-4">
            <Gift size={28} className="text-gold-500" />
          </div>
          <h2 className="font-display text-2xl text-white mb-2">Refer & Earn €10</h2>
          <p className="text-dark-400 max-w-sm mx-auto">
            Share your unique link. When a friend books their first transfer, you both earn €10 credit.
          </p>
        </div>
      </motion.div>

      {/* How it works */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06]">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">How it works</h3>
        <div className="space-y-3">
          {[
            { step: "1", title: "Share your link",    desc: "Copy and share your unique referral link or code with friends." },
            { step: "2", title: "Friend books",       desc: "Your friend uses your link to book their first Élite BCN transfer." },
            { step: "3", title: "Both earn €10",      desc: "Once their trip is completed, you both receive €10 credit on your accounts." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-gold-400 text-sm font-bold">{step}</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium">{title}</p>
                <p className="text-dark-400 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral code */}
      <div className="glass-card rounded-2xl p-5 border border-white/[0.06] space-y-3">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Your Referral Code</h3>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-dark-800 border border-white/[0.08]">
          <span className="font-mono text-lg text-gold-400 font-bold flex-1 tracking-widest">{referralCode}</span>
          <button
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-gold-500/10 border border-gold-500/20 text-gold-400 hover:bg-gold-500/15"}`}
          >
            {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy link</>}
          </button>
        </div>
        <p className="text-dark-500 text-xs truncate">{referralLink}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Referrals Sent", value: "0", icon: <Share2 size={16} /> },
          { label: "Completed",      value: "0", icon: <Check size={16} /> },
          { label: "Earnings",       value: "€0", icon: <Gift size={16} /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="glass-card rounded-xl p-4 border border-white/[0.06] text-center">
            <div className="flex items-center justify-center text-gold-500 mb-2">{icon}</div>
            <p className="font-display text-xl text-white">{value}</p>
            <p className="text-dark-500 text-[10px] mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
