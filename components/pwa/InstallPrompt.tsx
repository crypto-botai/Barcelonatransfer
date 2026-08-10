"use client";

import { useEffect, useState } from "react";
import { Download, Bell, X, Check, Share } from "lucide-react";

/**
 * Invitation to install the site as an app and turn on journey notifications.
 *
 * Deliberately restrained. It appears once, low on the page, and never as a
 * modal over the booking form — a prompt that interrupts someone mid-booking
 * costs more in abandoned bookings than it wins in installs.
 *
 * Dismissal is remembered for 30 days. Someone who said no should not be asked
 * again on their next visit.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "elitebcn.installPrompt.dismissedUntil";
const DISMISS_DAYS = 30;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    // Already running as an installed app — nothing to offer.
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() < until) return;
    } catch { /* blocked storage: treat as not dismissed */ }

    const onPrompt = (e: Event) => {
      // Chrome fires this when the app is installable. Holding onto it lets us
      // show our own invitation instead of the browser's own bar.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));

    // iOS never fires beforeinstallprompt — installing there is a manual Share
    // menu step, so it gets an explanation rather than a button that cannot work.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) { setIosHelp(true); setVisible(true); }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 864e5));
    } catch { /* preference simply will not persist */ }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
    setVisible(false);
  }

  if (!visible || installed) return null;

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="relative glass-card rounded-2xl border border-white/[0.07] p-6 sm:p-8 max-w-3xl mx-auto">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-dark-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-gold-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl text-white mb-1.5">
              Add Élite BCN to your phone
            </h2>
            <p className="text-dark-400 text-sm leading-relaxed mb-4">
              Get a message the moment your driver sets off, arrives and is waiting —
              plus an alert if your flight is delayed and we adjust your pickup.
            </p>

            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mb-5">
              {["Driver on the way", "Arrival alerts", "Flight delay warnings", "Live journey tracking"].map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-dark-300">
                  <Check size={11} className="text-emerald-400 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>

            {iosHelp ? (
              <p className="text-dark-300 text-sm flex items-start gap-2">
                <Share size={15} className="text-gold-400 flex-shrink-0 mt-0.5" />
                <span>
                  On iPhone: tap <strong className="text-white">Share</strong>, then{" "}
                  <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </p>
            ) : (
              <button
                onClick={install}
                className="btn-gold inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
              >
                <Download size={15} /> Install app
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
