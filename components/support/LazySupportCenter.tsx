"use client";

import dynamic from "next/dynamic";
import { useDeferredMount } from "@/lib/use-deferred-mount";

/**
 * The support centre is the largest client component in the tree and mounts on
 * every page, but it renders a floating help button — nothing above the fold
 * depends on it and it carries no SEO weight. Hydrating it in the initial pass
 * meant its chat UI, tab state and message handling all competed with the main
 * thread while the page was still trying to paint.
 *
 * It is now code-split (so its JS is not in the first-load bundle at all) and
 * mounted only once the page is idle or the user has interacted.
 */
const SupportCenter = dynamic(() => import("./SupportCenter"), { ssr: false });

export default function LazySupportCenter() {
  const ready = useDeferredMount();
  if (!ready) return null;
  return <SupportCenter />;
}
