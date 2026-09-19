"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Loader2, Share, SquarePlus } from "lucide-react";

/**
 * "Get ride updates on this phone", for one booking.
 *
 * A guest has no account; the tracking page proves the booking with its
 * code, and the phone is registered under the booking. A customer with an
 * account is registered under their account too. Both receive the same
 * pushes: driver on the way, arrived, waiting, on board, completed, and the
 * rating request.
 *
 * iPhone: Safari only delivers web push to sites added to the Home Screen
 * (iOS 16.4+), so on an iPhone browser tab this explains that first instead
 * of asking for a permission that could not work.
 */
type State = "checking" | "unsupported" | "ios-browser" | "denied" | "off" | "on" | "busy";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos() { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true; }

export default function RideAlerts({ bookingId, code, audience = "customer", compactIos = false }: { bookingId?: string; code?: string; audience?: "customer" | "driver"; /** The page already shows the Home Screen steps; say only what remains. */ compactIos?: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/push/config").then((r) => r.json()).then((d: { configured: boolean; publicKey: string | null }) => {
      if (!d.configured || !d.publicKey) { setState("unsupported"); return; }
      setKey(d.publicKey);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIos() && !isStandalone() ? "ios-browser" : "unsupported");
        return;
      }
      if (isIos() && !isStandalone()) { setState("ios-browser"); return; }
      if (Notification.permission === "denied") { setState("denied"); return; }
      navigator.serviceWorker.getRegistration("/sw.js")
        .then((reg) => reg?.pushManager.getSubscription() ?? null)
        .then((sub) => setState(sub ? "on" : "off"))
        .catch(() => setState("off"));
    }).catch(() => setState("unsupported"));
  }, []);

  const enable = useCallback(async () => {
    if (!key) return;
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), bookingId, code }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setState("on");
    } catch {
      setState("off");
    }
  }, [key, bookingId, code]);

  const disable = useCallback(async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint, bookingId, code }) }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally { setState("off"); }
  }, [bookingId, code]);

  if (state === "checking" || state === "unsupported") return null;

  const what = audience === "driver"
    ? "New jobs and messages from customers, the moment they happen."
    : "Chauffeur on the way, arrived, waiting, on board, completed. On your lock screen, no app needed.";

  if (state === "ios-browser" && compactIos) {
    return (
      <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-dark-400">
        <Bell size={12} className="mr-1.5 inline text-gold-400" />
        Available once you open Elite BCN from your Home Screen. A <span className="text-white">Turn on</span> button appears here then.
      </p>
    );
  }

  if (state === "ios-browser") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <p className="text-sm text-white inline-flex items-center gap-2"><Bell size={14} className="text-gold-400" /> Get ride updates on this iPhone</p>
        <p className="mt-1 text-xs text-dark-400">{what}</p>
        <ol className="mt-2 space-y-1 text-xs text-dark-300">
          <li className="inline-flex items-center gap-1.5">1. Tap <Share size={12} className="text-dark-200" /> Share in Safari</li><br />
          <li className="inline-flex items-center gap-1.5">2. Choose <SquarePlus size={12} className="text-dark-200" /> Add to Home Screen</li><br />
          <li>3. Open Elite BCN from your Home Screen and tap this button again</li>
        </ol>
      </div>
    );
  }

  if (state === "denied") {
    return <p className="text-xs text-dark-500">Notifications are blocked for this site. Allow them in your browser or phone settings to get ride updates.</p>;
  }

  const on = state === "on";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${on ? "border-gold-500/30 bg-gold-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <div className="min-w-0">
        <p className="text-sm text-white">{on ? "Ride updates are on for this phone" : "Get ride updates on this phone"}</p>
        <p className="text-xs text-dark-400">{what}</p>
      </div>
      <button
        type="button" onClick={on ? disable : enable} disabled={state === "busy"} aria-pressed={on}
        className={`flex h-11 flex-shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium disabled:opacity-50 ${on ? "border border-gold-500/40 text-gold-300" : "bg-gold-500 text-black"}`}
      >
        {state === "busy" ? <Loader2 size={15} className="animate-spin" /> : on ? <BellRing size={15} /> : <Bell size={15} />}
        {on ? "On" : "Turn on"}
      </button>
    </div>
  );
}
