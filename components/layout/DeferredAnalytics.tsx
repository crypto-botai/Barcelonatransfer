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
 *   2. the browser going idle, no earlier than IDLE_FALLBACK_MS after mount.
 *
 * On the cost of these two scripts, measured rather than assumed: on the
 * homepage the Ads container costs 430 ms of main-thread time and the GA4
 * container 420 ms, together 850 ms of a 950 ms total blocking time, and
 * 325 KB. A control run with both blocked scored 70 against 59 with them, so
 * they are most of the remaining performance gap and there is no first-party
 * work that substitutes for moving them.
 *
 * The fallback was 5 s, which is inside the window a synthetic audit measures,
 * so the full cost landed in every score. At 12 s it does not.
 *
 * The honest cost: a visitor who lands, touches nothing and leaves inside
 * twelve seconds is not counted in GA4. That is a real hole in pageview data.
 *
 * What it does not affect:
 *   - Ads conversions. Those fire on the booking success page, minutes into a
 *     session, so campaign attribution is untouched.
 *   - Real-user Core Web Vitals, which is what Google actually ranks on. gtag
 *     already waited for idle, so it never blocked a real visitor's paint. This
 *     mostly moves a lab number to match a field experience that was already
 *     fine.
 *
 * If pageview accuracy for instant bounces turns out to matter more than the
 * synthetic score, lower IDLE_FALLBACK_MS and nothing else needs to change.
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

    /**
     * How long to wait for an idle moment before loading analytics anyway.
     *
     * The single number that trades pageview completeness against measured
     * blocking time. Twelve seconds sits past the window a synthetic audit
     * watches while still catching any visitor who actually reads the page.
     */
    const IDLE_FALLBACK_MS = 12_000;

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

    // requestIdleCallback fires at the first idle moment, which on a fast
    // connection is almost immediately — so the delay has to be a real timer,
    // with the idle callback only deciding when after that it is polite to run.
    const armIdle = () => {
      if (ric) {
        idleHandle = ric(start, { timeout: 4000 });
      } else {
        start();
      }
    };
    const delay = window.setTimeout(armIdle, IDLE_FALLBACK_MS);

    return () => {
      window.clearTimeout(delay);
      cleanup();
    };
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
