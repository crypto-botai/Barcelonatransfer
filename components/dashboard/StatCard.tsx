"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  color?: "gold" | "green" | "blue" | "purple";
  animate?: boolean;
  delay?: number;
}

const COLOR_MAP = {
  gold:   { bg: "bg-gold-500/10",   border: "border-gold-500/20",   text: "text-gold-400",   glow: "shadow-[0_0_20px_rgba(201,168,76,0.15)]" },
  green:  { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]" },
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", glow: "shadow-[0_0_20px_rgba(168,85,247,0.1)]" },
};

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * target));
        if (progress < 1) requestAnimationFrame(step);
        else setCount(target);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, duration, delay]);
  return count;
}

export default function StatCard({ label, value, prefix = "", suffix = "", icon, color = "gold", animate: doAnimate = true, delay = 0 }: Props) {
  const numericValue = typeof value === "number" ? value : 0;
  const animated = useCountUp(doAnimate && typeof value === "number" ? numericValue : 0, 1000, delay);
  const displayValue = doAnimate && typeof value === "number" ? animated : value;
  const c = COLOR_MAP[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.5, ease: "easeOut" }}
      className={`glass-card rounded-2xl p-5 border ${c.border} ${c.glow} hover:border-opacity-40 transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-dark-400 text-xs uppercase tracking-widest font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-1">
        {prefix && <span className={`text-lg font-semibold ${c.text} mb-0.5`}>{prefix}</span>}
        <span className={`font-display text-3xl text-white stat-number`}>{typeof displayValue === "number" ? displayValue.toLocaleString() : displayValue}</span>
        {suffix && <span className="text-dark-400 text-sm mb-1 ml-1">{suffix}</span>}
      </div>
    </motion.div>
  );
}
