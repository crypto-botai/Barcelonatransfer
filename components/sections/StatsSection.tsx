"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const STATS = [
  { value: 5000, suffix: "+", label: "Transfers Completed", sub: "Since 2018" },
  { value: 49, suffix: "★", label: "Average Google Rating", sub: "From 300+ reviews", transform: (v: number) => (v / 10).toFixed(1) },
  { value: 24, suffix: "/7", label: "Hours Available",       sub: "365 days a year" },
  { value: 100, suffix: "%",  label: "On-Time Guarantee",   sub: "Flight monitoring" },
];

function Counter({ target, suffix, transform }: { target: number; suffix: string; transform?: (v: number) => string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const start = performance.now();
    const dur = 1800;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);

  return (
    <div ref={ref} className="font-display text-5xl sm:text-6xl text-white stat-number">
      {transform ? transform(count) : count.toLocaleString()}{suffix}
    </div>
  );
}

export default function StatsSection() {
  return (
    <section className="py-20 bg-dark-950 relative overflow-hidden">
      {/* Gold line accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />

      {/* Background orb */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(201,168,76,0.04),transparent)]" />

      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center py-6 lg:py-0"
            >
              <Counter target={s.value} suffix={s.suffix} transform={s.transform} />
              <p className="text-dark-200 font-medium mt-2">{s.label}</p>
              <p className="text-dark-500 text-xs mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
