"use client";

import { Toaster } from "react-hot-toast";

/**
 * The toast container, mounted only where toasts are actually raised.
 *
 * <Toaster /> sat in the root layout, which put react-hot-toast on all 110
 * pages. Toasts are raised in exactly six places: /book, /contact, and the
 * admin, auth, dashboard and driver areas — every one of which already has its
 * own layout file. The other 104 pages, which are the marketing pages that need
 * to be fast, downloaded and hydrated a notification library that never fired.
 *
 * Styling is unchanged from the root-layout version, so a toast looks exactly
 * as it did.
 */
export default function ToastHost() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#1a1a1a",
          color: "#fff",
          border: "1px solid rgba(201,168,76,0.3)",
          borderRadius: "8px",
        },
      }}
    />
  );
}
