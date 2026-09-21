"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A panel that tilts a few degrees towards the pointer, with a soft light
 * where the pointer is, so it reads as a physical card lying on the page
 * rather than a rectangle painted on it.
 *
 * Pointer position is kept in motion values and springs: nothing here goes
 * through React state, so tracking the mouse costs no re-renders. On touch
 * devices there is no pointer to follow and the card lies flat; under
 * prefers-reduced-motion it lies flat everywhere.
 */
export default function TiltCard({ children, className, maxTilt = 5 }: { children: ReactNode; className?: string; maxTilt?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // -0.5 … 0.5 across the card, both axes.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 160, damping: 22, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 160, damping: 22, mass: 0.6 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-maxTilt, maxTilt]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const lightX = useTransform(sx, [-0.5, 0.5], [15, 85]);
  const lightY = useTransform(sy, [-0.5, 0.5], [10, 90]);
  const sheen = useMotionTemplate`radial-gradient(520px circle at ${lightX}% ${lightY}%, rgba(245,224,169,0.13), rgba(245,224,169,0) 62%)`;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === "touch" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); };

  return (
    <div style={{ perspective: 1400 }} className="[transform-style:preserve-3d]">
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn(
          "relative isolate overflow-hidden rounded-3xl",
          "border border-[#c9a84c]/25",
          "bg-[linear-gradient(160deg,rgba(28,24,16,0.92)_0%,rgba(12,11,9,0.96)_55%,rgba(20,17,11,0.94)_100%)]",
          // Top-edge light, bottom-edge shade, and a deep shadow that reads as
          // the card standing slightly off the page.
          "shadow-[inset_0_1px_0_rgba(245,224,169,0.22),inset_0_-1px_0_rgba(0,0,0,0.6),0_40px_80px_-30px_rgba(0,0,0,0.85),0_18px_40px_-24px_rgba(201,168,76,0.35)]",
          className,
        )}
      >
        {!reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ backgroundImage: sheen }} />}
        {/* A hairline inside the edge, one pixel in, as on a real card. */}
        <div aria-hidden className="pointer-events-none absolute inset-[1px] -z-10 rounded-[23px] border border-white/[0.04]" />
        {children}
      </motion.div>
    </div>
  );
}
