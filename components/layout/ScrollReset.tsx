"use client";
import { useEffect } from "react";

export default function ScrollReset() {
  useEffect(() => {
    // Prevent browser restoring scroll to fleet or any mid-page position
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);
  return null;
}
