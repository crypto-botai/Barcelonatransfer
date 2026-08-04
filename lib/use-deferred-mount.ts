"use client";

import { useEffect, useState } from "react";

/**
 * Returns false until the page is past its critical work, then true.
 *
 * Flips on whichever comes first:
 *   1. the first genuine user interaction (scroll, pointer, key, touch), or
 *   2. the browser reporting idle via requestIdleCallback (with a timeout so
 *      it still fires on browsers that stay busy or lack the API).
 *
 * Used to keep non-critical client components — analytics, the support widget —
 * out of the initial hydration pass, where they compete with the main thread
 * and delay the largest contentful paint.
 */
export function useDeferredMount(timeout = 5000): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    let idleHandle: number | undefined;
    let timer: number | undefined;
    const events: Array<keyof WindowEventMap> = ["scroll", "pointerdown", "keydown", "touchstart"];

    const start = () => {
      setReady(true);
      cleanup();
    };

    const cleanup = () => {
      events.forEach((e) => window.removeEventListener(e, start));
      if (timer !== undefined) window.clearTimeout(timer);
      if (idleHandle !== undefined && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (h: number) => void }).cancelIdleCallback(idleHandle);
      }
    };

    events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;

    if (ric) idleHandle = ric(start, { timeout });
    else timer = window.setTimeout(start, timeout);

    return cleanup;
  }, [ready, timeout]);

  return ready;
}
