"use client";

import { useEffect } from "react";
import { captureOppref } from "@/lib/tracking/oppref";

/**
 * Catches ?oppref= on whatever page the visitor lands on.
 *
 * Mounted in the root layout rather than on /book, because an ad points at a
 * destination or service page and the visitor reaches the booking form by
 * navigating — at which point the parameter is no longer in the URL. This
 * has to run on the first page of the visit, whichever page that is.
 *
 * Renders nothing and never blocks: the capture is wrapped so a blocked
 * localStorage cannot throw into the page.
 */
export default function OpprefCapture() {
  useEffect(() => {
    captureOppref();
  }, []);

  return null;
}
