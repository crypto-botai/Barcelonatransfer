"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

type State = "checking" | "unsupported" | "denied" | "off" | "on" | "busy";

/**
 * VAPID public keys are base64url; the browser needs raw bytes.
 *
 * Backed by an explicit ArrayBuffer so the result is `Uint8Array<ArrayBuffer>`
 * rather than `Uint8Array<ArrayBufferLike>` — only the former satisfies
 * BufferSource, which is what applicationServerKey expects.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Opt-in toggle for push notifications.
 *
 * Deliberately never prompts on page load. An unprompted permission dialog is
 * the fastest way to get permanently blocked by a browser, and a blocked
 * permission cannot be re-requested — the customer would have to dig through
 * site settings. The dialog only opens on a deliberate tap.
 */
export default function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (!vapidPublicKey || typeof window === "undefined") { setState("unsupported"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidPublicKey]);

  const enable = useCallback(async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(String(res.status));

      setState("on");
    } catch {
      // Leave the browser subscription in place if only our server call failed;
      // the next attempt will upsert it rather than duplicate it.
      setState("off");
    }
  }, [vapidPublicKey]);

  const disable = useCallback(async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }, []);

  if (state === "checking" || state === "unsupported") return null;

  if (state === "denied") {
    return (
      <p className="text-dark-500 text-[11px] leading-relaxed">
        Notifications are blocked for this site. You can re-enable them in your browser&apos;s site settings.
      </p>
    );
  }

  const on = state === "on";

  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={state === "busy"}
      aria-pressed={on}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        on ? "bg-gold-500/15 text-gold-300" : "bg-white/[0.05] text-dark-300 hover:text-white"
      }`}
    >
      {state === "busy" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : on ? (
        <Bell size={13} />
      ) : (
        <BellOff size={13} />
      )}
      {on ? "Push notifications on" : "Get notified on this device"}
    </button>
  );
}
