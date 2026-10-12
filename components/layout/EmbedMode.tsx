"use client";

import { useEffect } from "react";

/**
 * The payment pages shown inside the mobile apps.
 *
 * The apps open the payment page in their own screen and add `?app=1`. This notes it for the rest of that visit (the payment page
 * moves on to the confirmation page, which no longer has the parameter) and marks the page, so the website's own menu bar, the
 * floating booking bar and the chat button are not drawn: inside the app they only get in the way. A normal browser visit never
 * has the parameter, so the website is unchanged.
 */
export default function EmbedMode() {
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("app") === "1") window.sessionStorage.setItem("elitebcn-embed", "app");
      if (window.sessionStorage.getItem("elitebcn-embed") === "app") document.documentElement.dataset.embed = "app";
    } catch {
      /* storage blocked: the page simply keeps its menu */
    }
  }, []);
  return null;
}
