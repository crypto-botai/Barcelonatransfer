import Link from "next/link";
import Navbar from "@/components/layout/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(201,168,76,0.06),transparent)]" />
        </div>

        <div className="relative z-10 text-center max-w-lg">
          {/* Logo mark */}
          <div className="flex items-center justify-center gap-2.5 mb-10">
            <div className="w-10 h-10 border border-[#c9a84c] rotate-45 flex items-center justify-center">
              <div className="w-4 h-4 bg-[#c9a84c]" />
            </div>
            <span className="font-display text-2xl tracking-[0.25em]">
              <span className="text-white">ÉLITE</span><span className="text-[#c9a84c]">BCN</span>
            </span>
          </div>

          <p className="text-[#c9a84c] text-[11px] tracking-[0.4em] uppercase font-medium mb-4">404 — Page Not Found</p>
          <h1 className="font-display text-5xl sm:text-6xl text-white mb-4 leading-tight">
            Wrong Turn
          </h1>
          <p className="text-white/35 text-base mb-10 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.<br />
            Let us take you somewhere better.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="btn-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold tracking-wide"
            >
              Back to Home
            </Link>
            <Link
              href="/book"
              className="btn-outline-gold inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold tracking-wide"
            >
              Book a Transfer
            </Link>
          </div>

          <p className="text-white/15 text-xs mt-12">
            Need help?{" "}
            <a href="https://wa.me/34635383712" className="text-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors">
              Chat on WhatsApp
            </a>
            {" "}or call{" "}
            <a href="tel:+34635383712" className="text-[#c9a84c]/50 hover:text-[#c9a84c] transition-colors">
              +34 635 383 712
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
