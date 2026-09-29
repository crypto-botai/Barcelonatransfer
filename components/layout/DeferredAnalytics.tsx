"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Loads gtag.js — the heavy half of the Google tag — off the critical path.
 *
 * The tag is two separate things, and they used to be deferred together:
 *
 *   1. The `gtag()` shim and the `config` commands. A few hundred bytes of
 *      inline JavaScript, no network request, no measurable main-thread cost.
 *      That half now runs in the document head (see app/layout.tsx) so it is
 *      in place before anything on the page can fire an event.
 *   2. gtag.js itself — ~161 KiB of third-party script. On the homepage the
 *      Ads container costs 430 ms of main-thread time and the GA4 container
 *      420 ms: together 850 ms of a 950 ms total blocking time, and 325 KB. A
 *      control run with both blocked scored 70 against 59 with them. That is
 *      the half this component defers, so the whole performance win is kept.
 *
 * Deferring (1) along with (2) broke conversion tracking invisibly:
 * `window.gtag` did not exist for the first twelve seconds of a visit, so an
 * event fired before then had nowhere to go. Worse, an event that did queue
 * landed in `dataLayer` ahead of the `config` command, and gtag.js drains the
 * queue in order — an event processed before its property is configured is
 * discarded rather than replayed.
 *
 * It now mounts on whichever comes first:
 *   1. the first real user interaction (scroll, pointer, key, touch), or
 *   2. the browser going idle, no earlier than IDLE_FALLBACK_MS after mount.
 *
 * …except on a conversion page, where it loads straight away. See below.
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

/**
 * Pages where the script loads immediately instead of waiting for idle.
 *
 * The payment success page is where `order_created` fires. A customer can
 * read that page without scrolling or touching anything, and a tab closed
 * before the idle fallback would lose the conversion that paid for the click.
 * It is also the one page on the site where load time has no commercial
 * consequence: the money is already taken.
 *
 * Conversion pages only. Adding an ordinary page here gives back the blocking
 * time the deferral exists to remove.
 */
const IMMEDIATE_PATHS = ["/booking/success"];

export default function DeferredAnalytics({
  gaId,
}: {
  /** The GA4 measurement ID. One — see the note above on the cost of more. */
  gaId: string;
}) {
  const pathname = usePathname();
  const immediate = IMMEDIATE_PATHS.some((p) => pathname?.startsWith(p));
  const [load, setLoad] = useState(immediate);

  useEffect(() => {
    if (load) return;

    /**
     * How long to wait for an idle moment before loading analytics anyway.
     *
     * The single number that trades pageview completeness against measured
     * blocking time. Twelve seconds sits past the window a synthetic audit
     * watches while still catching any visitor who actually reads the page.
     *
     * The honest cost: a visitor who lands, touches nothing and leaves inside
     * twelve seconds is not counted in GA4. That is a real hole in pageview
     * data, and it is why conversion pages opt out above.
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

  return <Script id="_next-ga" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />;
}
