"use client";

import { useCallback, useEffect, useState } from "react";

export type AlertState = "checking" | "unsupported" | "denied" | "off" | "on" | "busy";

/** VAPID keys are base64url; the browser wants raw bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Desktop notifications for this browser.
 *
 * Turning them on registers the browser for web push, which is what makes an
 * alert appear even when the admin tab is closed (the browser itself must be
 * running). It only ever asks for permission from a click: a prompt on page
 * load is the quickest way to be blocked for good.
 */
export function useDesktopAlerts() {
  const [state, setState] = useState<AlertState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }

      const cfg = (await (await fetch("/api/push/config", { cache: "no-store" })).json()) as { configured?: boolean; publicKey?: string | null };
      if (!cfg.configured || !cfg.publicKey) throw new Error("Push alerts are not set up on the server.");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Sign in again, then retry." : `The server refused the subscription (${res.status}).`);
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn alerts on.");
      setState("off");
    }
  }, []);

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

  /** Sends a real notification through this browser, to prove it works. */
  const test = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Elite BCN · WhatsApp", {
        body: "Desktop alerts are working. New customer messages will appear like this.",
        icon: "/icon-192.png",
        tag: "wa:test",
      });
    } catch {
      setError("This browser would not show the test notification.");
    }
  }, []);

  return { state, error, enable, disable, test };
}
