"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

/**
 * Loads Google Analytics off the critical path.
 *
 * Loaded eagerly, gtag/js is ~161 KiB of third-party JavaScript that competes
 * with the page's own render work — Lighthouse attributed several long
 * main-thread tasks and a large share of unused JS to it, and it was the
 * single biggest non-first-party cost on the homepage.
 *
 * It now mounts on whichever comes first:
 *   1. the first real user interaction (scroll, pointer, key, touch), or
 *   2. the browser going idle (requestIdleCallback, with a timeout so it
 *      still fires on browsers that stay busy or lack the API).
 *
 * Page views are still recorded — GA reports the view whenever it initialises,
 * and the delay is on the order of a second on a normal connection. The only
 * genuine loss is a visitor who closes the tab before the browser ever goes
 * idle, which is a very small share of traffic and a fair trade for the
 * render cost it removes.
 */
export default function DeferredAnalytics({ gaId }: { gaId: string }) {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (load) return;

    let idleHandle: number | undefined;
    const events: Array<keyof WindowEventMap> = ["scroll", "pointerdown", "keydown", "touchstart"];

    const start = () => {
      setLoad(true);
      cleanup();
    };

    const cleanup = () => {
      events.forEach((e) => window.removeEventListener(e, start));
      if (idleHandle !== undefined && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(idleHandle);
      }
    };

    events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (ric) {
      idleHandle = ric(start, { timeout: 5000 });
    } else {
      const t = window.setTimeout(start, 4000);
      return () => { window.clearTimeout(t); cleanup(); };
    }

    return cleanup;
  }, [load]);

  if (!load) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
