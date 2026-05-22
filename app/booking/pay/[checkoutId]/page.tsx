"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, AlertCircle, CreditCard } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

declare global {
  interface Window {
    SumUpCard: {
      mount: (options: {
        id: string;
        checkoutId: string;
        onResponse?: (type: string, body: unknown) => void;
        onLoad?: () => void;
        showSubmitButton?: boolean;
        showFooter?: boolean;
        showInstallments?: boolean;
        locale?: string;
        currency?: string;
      }) => { unmount: () => void };
    };
  }
}

function PayInner() {
  const params     = useParams<{ checkoutId: string }>();
  const search     = useSearchParams();
  const router     = useRouter();
  const checkoutId = params.checkoutId;
  const bookingId  = search.get("booking_id") ?? "";

  const [sdkReady,  setSdkReady]  = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const [error,     setError]     = useState("");
  const [status,    setStatus]    = useState<"idle" | "processing" | "success" | "failed">("idle");
  const widgetRef   = useRef<{ unmount: () => void } | null>(null);
  const scriptRef   = useRef<HTMLScriptElement | null>(null);
  const didMount    = useRef(false);

  // Load SumUp SDK
  useEffect(() => {
    if (scriptRef.current || window.SumUpCard) { setSdkReady(true); return; }

    const script = document.createElement("script");
    script.src   = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";
    script.async = true;
    script.onload  = () => setSdkReady(true);
    script.onerror = () => setError("Failed to load payment SDK. Please refresh the page.");
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      widgetRef.current?.unmount();
    };
  }, []);

  // Mount widget once SDK is ready
  useEffect(() => {
    if (!sdkReady || didMount.current || !checkoutId || !window.SumUpCard) return;
    didMount.current = true;

    try {
      widgetRef.current = window.SumUpCard.mount({
        id:                 "sumup-card",
        checkoutId,
        locale:             "en-GB",
        showSubmitButton:   true,
        showFooter:         true,
        showInstallments:   false,
        onLoad: () => {
          setMounted(true);
          setStatus("idle");
        },
        onResponse: (type, body) => {
          console.log("[SumUp] response", type, body);
          if (type === "success") {
            setStatus("success");
            const dest = bookingId
              ? `/booking/success?booking_id=${bookingId}`
              : "/booking/success";
            setTimeout(() => router.replace(dest), 1500);
          } else if (type === "error") {
            setStatus("failed");
            const b = body as { message?: string } | null;
            setError(b?.message ?? "Payment failed. Please try again.");
          } else if (type === "sent") {
            setStatus("processing");
          }
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not initialise payment widget.");
    }
  }, [sdkReady, checkoutId, bookingId, router]);

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto mb-4">
            <CreditCard size={24} className="text-gold-400" />
          </div>
          <h1 className="font-display text-2xl text-white mb-1">Secure Payment</h1>
          <p className="text-dark-400 text-sm">Complete your Élite BCN booking</p>
        </div>

        {/* Widget card */}
        <div className="glass-card rounded-2xl p-6">
          {!sdkReady && !error && (
            <div className="flex items-center justify-center py-12 gap-3 text-dark-400">
              <Loader2 size={20} className="animate-spin text-gold-500" />
              <span className="text-sm">Loading secure payment form…</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm font-medium">Payment Error</p>
                <p className="text-red-400/70 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={28} className="text-green-400" />
              </div>
              <p className="text-white font-semibold text-lg">Payment Successful!</p>
              <p className="text-dark-400 text-sm mt-2">Redirecting to your booking confirmation…</p>
              <Loader2 size={16} className="text-gold-500 animate-spin mx-auto mt-4" />
            </motion.div>
          )}

          {status === "processing" && (
            <div className="text-center py-4 mb-4">
              <Loader2 size={20} className="text-gold-500 animate-spin mx-auto mb-2" />
              <p className="text-dark-400 text-sm">Processing your payment…</p>
            </div>
          )}

          {/* SumUp widget mounts here */}
          <div
            id="sumup-card"
            className={status === "success" ? "hidden" : ""}
            style={{ minHeight: sdkReady && !mounted ? "200px" : undefined }}
          />

          {!mounted && sdkReady && !error && (
            <div className="flex items-center justify-center py-8 gap-3 text-dark-400">
              <Loader2 size={18} className="animate-spin text-gold-500" />
              <span className="text-sm">Initialising payment form…</span>
            </div>
          )}
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-5 text-dark-600 text-xs">
          <ShieldCheck size={13} />
          <span>256-bit SSL encrypted · Powered by SumUp</span>
        </div>

        {/* WhatsApp fallback */}
        <p className="text-center text-xs text-dark-600 mt-3">
          Problems paying?{" "}
          <a
            href={`https://wa.me/34635383712?text=${encodeURIComponent("Hi! I need help with my Élite BCN payment.")}`}
            target="_blank"
            rel="noreferrer"
            className="text-gold-500 hover:text-gold-400 underline"
          >
            Contact us on WhatsApp
          </a>
        </p>
      </motion.div>
    </main>
  );
}

export default function PayPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <PayInner />
      </Suspense>
    </>
  );
}
