"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Loads Google Analytics and Google Ads off the critical path.
 *
 * Loaded eagerly, gtag.js is ~161 KiB of third-party JavaScript that competes
 * with the page's own render work — Lighthouse attributed several long
 * main-thread tasks and a large share of unused JS to it, and it was the
 * single biggest non-first-party cost on the homepage.
 *
 * It now mounts on whichever comes first:
 *   1. the first real user interaction (scroll, pointer, key, touch), or
 *   2. the browser going idle (requestIdleCallback, with a timeout so it
 *      still fires on browsers that stay busy or lack the API).
 *
 * Page views are still recorded — both properties report the view whenever
 * gtag initialises, and the delay is on the order of a second on a normal
 * connection. The only genuine loss is a visitor who closes the tab before
 * the browser ever goes idle, which is a very small share of traffic and a
 * fair trade for the render cost it removes.
 *
 * One gtag.js load serves both IDs. The Google-provided snippet for each
 * property loads its own copy of the same script, but gtag.js is generic —
 * the src URL's ?id= only selects which property gets auto-configured, and a
 * `gtag('config', …)` call attaches the other to the library already on the
 * page.
 *
 * That is not the same as free. gtag fetches a container per configured
 * property, and each one costs roughly 400 ms of main-thread time and
 * 160-190 KB. A second GA4 property ran here for four days and accounted for a
 * third of the site's total blocking time on every page, while splitting the
 * traffic so neither property saw the whole picture. One is the default for a
 * reason.
 */
export default function DeferredAnalytics({
  gaId,
  adsId,
}: {
  /** The GA4 measurement ID. One — see the note above on the cost of more. */
  gaId: string;
  adsId?: string;
}) {
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

  return (
    <>
      <Script
        id="_next-ga-init"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
            ${adsId ? `gtag('config', '${adsId}');` : ""}
          `,
        }}
      />
      <Script id="_next-ga" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
    </>
  );
}
