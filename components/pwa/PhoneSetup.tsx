"use client";

import { useEffect, useState } from "react";
import { Check, Download, MoreVertical, Share, Smartphone, SquarePlus } from "lucide-react";
import RideAlerts from "@/components/notifications/RideAlerts";

/**
 * After payment: the two things that make the day of the ride easy.
 *
 *   1. Turn on ride updates, so the phone buzzes when the chauffeur sets
 *      off, arrives and is waiting.
 *   2. Put Elite BCN on the Home Screen, so the tracking page is one tap
 *      away and, on iPhone, so notifications can be delivered at all.
 *
 * Always shown on this page and never dismissed: it is the moment the
 * customer is most willing, and the page is only seen once.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PhoneSetup({ bookingId, code }: { bookingId: string; code: string }) {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "desktop");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  if (platform === "desktop") {
    // On a computer the useful half is the notifications toggle; the phone
    // steps make no sense here.
    return <div className="text-left"><RideAlerts bookingId={bookingId} code={code} /></div>;
  }

  return (
    <div className="text-left rounded-2xl border border-gold-500/30 bg-gold-500/[0.05] p-5">
      <p className="inline-flex items-center gap-2 text-white font-medium"><Smartphone size={16} className="text-gold-400" /> Set up your phone for the day of the ride</p>
      <p className="text-dark-400 text-xs mt-1">Two taps now, and your chauffeur&apos;s every move reaches your lock screen.</p>

      <div className="mt-4 space-y-4">
        {platform === "ios" ? (
          <>
            {/* iPhone: the Home Screen comes first, because Safari only
                delivers notifications to a site installed there. */}
            <Step n={1} title="Add Elite BCN to your Home Screen" done={installed}>
              {installed ? <p className="text-xs text-emerald-300">Done.</p> : (
                <ol className="space-y-2 text-sm text-dark-200">
                  <li className="flex flex-wrap items-center gap-x-1.5"><span className="text-dark-500 text-xs w-4">1.</span>Tap <Share size={15} className="text-gold-300" /> <span className="text-white">Share</span> at the bottom of Safari</li>
                  <li className="flex flex-wrap items-center gap-x-1.5"><span className="text-dark-500 text-xs w-4">2.</span>Tap <SquarePlus size={15} className="text-gold-300" /> <span className="text-white">Add to Home Screen</span>, then <span className="text-white">Add</span></li>
                  <li className="flex flex-wrap items-center gap-x-1.5"><span className="text-dark-500 text-xs w-4">3.</span>Open <span className="text-white">Elite BCN</span> from your Home Screen</li>
                </ol>
              )}
            </Step>
            <Step n={2} title="Turn on ride updates" done={false}>
              <RideAlerts bookingId={bookingId} code={code} compactIos />
            </Step>
          </>
        ) : (
          <>
            <Step n={1} title="Turn on ride updates" done={false}>
              <RideAlerts bookingId={bookingId} code={code} />
            </Step>
            <Step n={2} title="Add Elite BCN to your Home Screen" done={installed}>
              {installed ? (
                <p className="text-xs text-emerald-300">Done. Open Elite BCN from your Home Screen to track your ride.</p>
              ) : deferred ? (
                <button type="button" onClick={install} className="btn-gold inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
                  <Download size={15} /> Install Elite BCN
                </button>
              ) : (
                <ol className="space-y-2 text-sm text-dark-200">
                  <li className="flex flex-wrap items-center gap-x-1.5"><span className="text-dark-500 text-xs w-4">1.</span>Tap <MoreVertical size={15} className="text-gold-300" /> the menu at the top of Chrome</li>
                  <li className="flex flex-wrap items-center gap-x-1.5"><span className="text-dark-500 text-xs w-4">2.</span>Tap <span className="text-white">Add to Home screen</span> or <span className="text-white">Install app</span></li>
                </ol>
              )}
            </Step>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-gold-500/40 text-gold-300"}`}>
        {done ? <Check size={12} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white mb-2">{title}</p>
        {children}
      </div>
    </div>
  );
}
