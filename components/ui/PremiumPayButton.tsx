"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The pay button.
 *
 * Built like a piece of metal rather than a flat fill: a brushed-gold body,
 * a hairline of darker gold around the edge, a one-pixel highlight along the
 * top where light would catch it, and a shadow tinted with the same gold so
 * it sits in the page instead of floating over it. No outer glow.
 *
 * Three motions, each with a reason:
 *   - A light pass across the face, once, when the button first comes into
 *     view: this is the one thing on the page to press.
 *   - A soft highlight that follows the pointer while hovering, driven by
 *     motion values (never React state), so the surface reads as a material.
 *   - A physical press: down a pixel and in by 1.5%, on a spring.
 *
 * All three collapse to a still button under prefers-reduced-motion.
 *
 * Loading is not a spinner. The label changes to say what is happening and a
 * thin light travels along the bottom edge until the redirect lands.
 */
export default function PremiumPayButton({
  amount, label = "Pay", onClick, disabled = false, loading = false, loadingLabel = "Securing your booking", size = "lg", className, children,
}: {
  amount: string;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  size?: "lg" | "md";
  className?: string;
  /** Optional trailing note inside the button, e.g. the balance to follow. */
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);

  // Pointer position inside the button, as motion values. Reading these into
  // React state would re-render the form on every mouse move.
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const sx = useSpring(px, { stiffness: 220, damping: 28 });
  const sy = useSpring(py, { stiffness: 220, damping: 28 });
  const spotlight = useMotionTemplate`radial-gradient(140px circle at ${sx}% ${sy}%, rgba(255,250,235,0.55), rgba(255,250,235,0) 70%)`;

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set(((e.clientX - r.left) / r.width) * 100);
    py.set(((e.clientY - r.top) / r.height) * 100);
  };
  const onPointerLeave = () => { px.set(50); py.set(50); };

  const inert = disabled || loading;

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={inert}
      aria-busy={loading || undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      whileTap={inert || reduce ? undefined : { scale: 0.985, y: 1 }}
      whileHover={inert || reduce ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={cn(
        "group relative isolate overflow-hidden rounded-xl font-semibold text-[#120f08]",
        "border border-[#8d6f2a]/80",
        "bg-[linear-gradient(180deg,#f3dfa2_0%,#dcbd6c_38%,#c9a84c_62%,#d9b964_100%)]",
        // A one-pixel light along the top edge, a darker one along the bottom,
        // and a shadow tinted to the metal. Nothing glows.
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(90,64,12,0.35),0_14px_34px_-14px_rgba(201,168,76,0.55),0_2px_6px_rgba(0,0,0,0.35)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:saturate-[0.85]",
        size === "lg" ? "h-14 px-6 text-[15px]" : "h-12 px-5 text-sm",
        className,
      )}
    >
      {/* Brushed texture: fine diagonal lines at very low contrast. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] mix-blend-multiply"
        style={{ backgroundImage: "repeating-linear-gradient(115deg, rgba(60,40,0,0.25) 0 1px, transparent 1px 3px)" }}
      />

      {/* Pointer highlight. */}
      {!reduce && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ backgroundImage: spotlight }} />
      )}

      {/* One light pass when the button first appears. */}
      {!reduce && !inert && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -z-10 w-[45%] -skew-x-12 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.65)_50%,rgba(255,255,255,0)_100%)]"
          initial={{ x: "-160%" }}
          whileInView={{ x: "320%" }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
        />
      )}

      <span className="relative flex items-center justify-center gap-2.5 whitespace-nowrap leading-none">
        {loading ? (
          <span className="tracking-[0.02em]">{loadingLabel}<span className="inline-block w-4 text-left" aria-hidden>…</span></span>
        ) : (
          <>
            <Lock size={size === "lg" ? 15 : 13} strokeWidth={2.25} className="opacity-80" aria-hidden />
            <span className="tracking-[0.04em]">{label}</span>
            {/* Lining figures: Playfair's default old-style numerals hang below
                the baseline, which read as the price sitting lower than "Pay". */}
            <span className={cn("font-display leading-none [font-variant-numeric:lining-nums_tabular-nums]", size === "lg" ? "text-[21px]" : "text-lg")}>{amount}</span>
            {children}
          </>
        )}
      </span>

      {/* Loading: a thin light travelling along the bottom edge. */}
      {loading && !reduce && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-1/3 bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.9),rgba(255,255,255,0))]"
          initial={{ x: "-100%" }}
          animate={{ x: "400%" }}
          transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
