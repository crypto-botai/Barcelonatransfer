"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ShieldCheck, AlertCircle, MapPin, Calendar, Users, Car, Smartphone, Lock, MessageCircle, Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import TiltCard from "@/components/booking/TiltCard";
import PremiumPayButton from "@/components/ui/PremiumPayButton";
import PolicySummary from "@/components/booking/PolicySummary";
import { VEHICLE_CATALOG, FLEET_TO_DB_CLASS } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { PROTECTION_CUTOFF_HOURS, FREE_CANCEL_HOURS } from "@/lib/checkout-money";
import { GOOGLE_PAY, WALLET_LABEL } from "@/lib/wallets";

/**
 * The payment page: SumUp's card form, set inside our own page.
 *
 * SumUp draws the card fields inside an iframe we cannot style, so the page
 * does the rest: the journey being paid for beside the form, the amount
 * charged today in our own gold button (SumUp's grey "Pay" is switched off
 * and the widget submitted from ours), and the two policies a customer wants
 * to see at the exact moment they type a card number, one tap away.
 *
 * Motion is a staged entrance, the tilt of the card panel towards the
 * pointer, and the button's own light pass. All of it stills under
 * prefers-reduced-motion.
 */

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
        showAmount?: boolean;
        locale?: string;
        currency?: string;
        /** Renders a Google Pay button. Apple Pay needs no option: it
         *  appears by itself once the domain is registered with Apple. */
        googlePay?: { merchantId: string; merchantName: string };
      }) => { unmount: () => void; submit?: () => void };
    };
  }
}

type Summary = {
  status: "PAID" | "PENDING" | "FAILED";
  confirmationCode?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupDatetime?: string;
  vehicleClass?: string;
  passengers?: number;
  totalAmount?: number;
  depositAmount?: number | null;
  balanceAmount?: number | null;
  protectionFee?: number | null;
};

const stage: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 210, damping: 26 } },
};

function vehicleLabel(cls?: string) {
  if (!cls) return "";
  return VEHICLE_CATALOG.find((v) => v.class === cls || FLEET_TO_DB_CLASS[v.class] === cls)?.label ?? cls.replace(/_/g, " ");
}

function PayInner() {
  const params     = useParams<{ checkoutId: string }>();
  const search     = useSearchParams();
  const router     = useRouter();
  const reduce     = useReducedMotion();
  const checkoutId = params.checkoutId;
  const bookingId  = search.get("booking_id") ?? "";

  const [sdkReady,  setSdkReady]  = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const [ownButton, setOwnButton] = useState(true);
  const [error,     setError]     = useState("");
  const [status,    setStatus]    = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const widgetRef   = useRef<{ unmount: () => void; submit?: () => void } | null>(null);
  const scriptRef   = useRef<HTMLScriptElement | null>(null);
  const didMount    = useRef(false);

  // What is being paid for. The same endpoint the success page polls; here it
  // is read once, for the summary and the amount on the button.
  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/payments/verify?booking_id=${bookingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Summary | null) => { if (d) setSummary(d); })
      .catch(() => {});
  }, [bookingId]);

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
    return () => { widgetRef.current?.unmount(); };
  }, []);

  // Mount widget once SDK is ready. Our button submits it; if this build of
  // the SDK offers no submit(), SumUp's own button is shown instead.
  useEffect(() => {
    if (!sdkReady || didMount.current || !checkoutId || !window.SumUpCard) return;
    didMount.current = true;

    const onResponse = (type: string, body: unknown) => {
      if (type === "success") {
        setStatus("success");
        const dest = bookingId ? `/booking/success?booking_id=${bookingId}` : "/booking/success";
        setTimeout(() => router.replace(dest), 1500);
      } else if (type === "error" || type === "fail") {
        setStatus("failed");
        const b = body as { message?: string } | null;
        setError(b?.message ?? "Payment failed. Please check the card details and try again.");
      } else if (type === "sent") {
        setStatus("processing");
      }
    };

    try {
      widgetRef.current = window.SumUpCard.mount({
        id: "sumup-card", checkoutId, locale: "en-GB", currency: "EUR",
        showSubmitButton: false, showFooter: false, showInstallments: false,
        ...(GOOGLE_PAY ? { googlePay: GOOGLE_PAY } : {}),
        onLoad: () => {
          setMounted(true);
          setStatus("idle");
          if (typeof widgetRef.current?.submit !== "function") {
            // No programmatic submit: fall back to SumUp's button, with the amount on it.
            widgetRef.current?.unmount();
            setOwnButton(false);
            widgetRef.current = window.SumUpCard.mount({
              id: "sumup-card", checkoutId, locale: "en-GB", currency: "EUR",
              showSubmitButton: true, showFooter: false, showInstallments: false, showAmount: true,
              ...(GOOGLE_PAY ? { googlePay: GOOGLE_PAY } : {}),
              onLoad: () => setMounted(true), onResponse,
            });
          }
        },
        onResponse,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not initialise payment widget.");
    }
  }, [sdkReady, checkoutId, bookingId, router]);

  const pay = () => {
    if (!widgetRef.current?.submit) return;
    setError("");
    setStatus("processing");
    widgetRef.current.submit();
  };

  const dueToday = summary ? (summary.depositAmount && summary.depositAmount > 0 ? summary.depositAmount : summary.totalAmount ?? 0) : null;
  const balance  = summary?.balanceAmount ?? 0;
  const when     = summary?.pickupDatetime ? new Date(summary.pickupDatetime).toLocaleString("en-GB", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#050505] px-4 pb-16 pt-24 sm:pt-28">
      {/* Stage lighting: one warm pool behind the card, one cool one low right. Static. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(201,168,76,0.10),transparent_70%),radial-gradient(40%_35%_at_85%_100%,rgba(120,110,90,0.08),transparent_70%)]" />

      <motion.div variants={stage} initial={reduce ? false : "hidden"} animate="show" className="mx-auto w-full max-w-5xl">
        <motion.div variants={rise} className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-gold-500">Secure checkout</p>
          <h1 className="mt-3 font-display text-3xl text-white sm:text-4xl">One step from your chauffeur.</h1>
          {summary?.confirmationCode && (
            <p className="mt-2 text-sm text-dark-400">Booking <span className="font-mono tracking-wider text-dark-200">{summary.confirmationCode}</span></p>
          )}
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-7">
          {/* ── The journey ─────────────────────────────────────────── */}
          <motion.aside variants={rise} className="order-2 lg:order-1">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-dark-400">Your journey</h2>
              {summary ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <MapPin size={15} className="mt-0.5 flex-shrink-0 text-gold-400" />
                    <div className="min-w-0">
                      <dd className="text-white">{summary.pickupAddress}</dd>
                      {summary.dropoffAddress && <dd className="mt-1 text-dark-300">to {summary.dropoffAddress}</dd>}
                    </div>
                  </div>
                  {when && <div className="flex gap-3"><Calendar size={15} className="mt-0.5 flex-shrink-0 text-gold-400" /><dd className="text-dark-200">{when}</dd></div>}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-dark-300">
                    {summary.vehicleClass && <span className="inline-flex items-center gap-2"><Car size={15} className="text-gold-400" /> {vehicleLabel(summary.vehicleClass)}</span>}
                    {summary.passengers && <span className="inline-flex items-center gap-2"><Users size={15} className="text-gold-400" /> {summary.passengers} passengers</span>}
                  </div>
                </dl>
              ) : (
                <div className="mt-4 space-y-3" aria-hidden>
                  <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-3/5 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-2/5 animate-pulse rounded bg-white/[0.06]" />
                </div>
              )}

              {summary && dueToday != null && (
                <div className="mt-5 rounded-2xl border border-gold-500/20 bg-[linear-gradient(180deg,rgba(201,168,76,0.10),rgba(201,168,76,0.03))] p-4 shadow-[inset_0_1px_0_rgba(245,224,169,0.22)]">
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-dark-300">{balance > 0 ? "Due today" : "Total"}</span>
                    <span className="font-display text-3xl leading-none text-gold-300 [font-variant-numeric:lining-nums_tabular-nums]">{formatCurrency(dueToday)}</span>
                  </div>
                  {balance > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-dark-300">
                      Then <span className="text-white">{formatCurrency(balance)}</span> to your chauffeur on the day, cash or card. Total {formatCurrency(summary.totalAmount ?? 0)}.
                    </p>
                  )}
                  {(summary.protectionFee ?? 0) > 0 && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-dark-300"><ShieldCheck size={13} className="text-gold-400" /> Cancellation protection included: cancel free up to {PROTECTION_CUTOFF_HOURS} hours before pickup.</p>
                  )}
                </div>
              )}

              <ul className="mt-5 space-y-2 text-xs text-dark-400">
                {[
                  (summary?.protectionFee ?? 0) > 0 ? `Free cancellation up to ${PROTECTION_CUTOFF_HOURS} hours before pickup` : `Free cancellation up to ${FREE_CANCEL_HOURS} hours before pickup`,
                  "Flight tracked, 60 minutes of waiting included",
                  "Meet and greet with your name board",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2"><Check size={13} className="mt-0.5 flex-shrink-0 text-gold-400" /> {t}</li>
                ))}
              </ul>
            </div>
          </motion.aside>

          {/* ── The card ────────────────────────────────────────────── */}
          <motion.section variants={rise} className="order-1 lg:order-2" aria-label="Card payment">
            <TiltCard className="p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm text-white"><Lock size={14} className="text-gold-400" /> Card payment</p>
                {WALLET_LABEL && (
                  <p className="hidden items-center gap-1.5 text-[11px] text-dark-400 sm:flex"><Smartphone size={12} className="text-gold-500/70" /> {WALLET_LABEL}</p>
                )}
              </div>

              {error && (
                <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Payment did not go through</p>
                    <p className="mt-1 text-xs text-red-300/80">{error}</p>
                  </div>
                </div>
              )}

              {status === "success" ? (
                <motion.div initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
                  <motion.div
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold-500/40 bg-[linear-gradient(180deg,#f3dfa2,#c9a84c)] text-[#120f08] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                  >
                    <Check size={30} strokeWidth={2.5} />
                  </motion.div>
                  <p className="font-display text-2xl text-white">Payment received.</p>
                  <p className="mt-2 text-sm text-dark-400">Taking you to your confirmation.</p>
                </motion.div>
              ) : (
                <>
                  {/* SumUp's form. White by their design; set into a recessed slot. */}
                  <div className="rounded-2xl bg-white p-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.08)] sm:p-3">
                    {(!sdkReady || !mounted) && !error && (
                      <div className="space-y-3 p-3" aria-live="polite" aria-label="Loading secure payment form">
                        <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
                        <div className="h-12 animate-pulse rounded-lg bg-neutral-100" />
                        <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-200" />
                        <div className="h-12 animate-pulse rounded-lg bg-neutral-100" />
                        <div className="grid grid-cols-2 gap-3"><div className="h-12 animate-pulse rounded-lg bg-neutral-100" /><div className="h-12 animate-pulse rounded-lg bg-neutral-100" /></div>
                      </div>
                    )}
                    <div id="sumup-card" />
                  </div>

                  {ownButton && (
                    <div className="mt-5">
                      <PremiumPayButton
                        onClick={pay}
                        disabled={!mounted}
                        loading={status === "processing"}
                        loadingLabel="Confirming with your bank"
                        amount={dueToday != null ? formatCurrency(dueToday) : ""}
                        className="w-full"
                      />
                    </div>
                  )}

                  <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[11px] text-dark-400">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} className="text-gold-500/80" /> 256-bit SSL, PCI DSS Level 1</span>
                    {WALLET_LABEL && <span className="sm:hidden">{WALLET_LABEL}</span>}
                    <span>Powered by SumUp</span>
                  </p>
                </>
              )}
            </TiltCard>

            {status !== "success" && (
              <motion.div variants={rise} className="mt-4"><PolicySummary /></motion.div>
            )}

            {/* The two things people look for before typing a card number. */}
            <motion.div variants={rise} className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-dark-400">
              <Link href="/refund-policy" className="underline-offset-4 hover:text-gold-300 hover:underline">Refund and cancellation policy</Link>
              <Link href="/terms" className="underline-offset-4 hover:text-gold-300 hover:underline">Terms and conditions</Link>
              <a
                href={`https://wa.me/34635383712?text=${encodeURIComponent(`Hi! I need help paying for booking ${summary?.confirmationCode ?? ""}.`)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-gold-300"
              >
                <MessageCircle size={12} /> Help on WhatsApp
              </a>
            </motion.div>
          </motion.section>
        </div>
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
