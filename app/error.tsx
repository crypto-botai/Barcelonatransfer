"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050505", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 480 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "2.5rem" }}>
              <div style={{ width: 36, height: 36, border: "1.5px solid #c9a84c", transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 12, height: 12, background: "#c9a84c" }} />
              </div>
              <span style={{ fontSize: 22, letterSpacing: "0.25em", color: "#fff", fontFamily: "Georgia, serif" }}>
                ÉLITE<span style={{ color: "#c9a84c" }}>BCN</span>
              </span>
            </div>

            <p style={{ color: "#c9a84c", fontSize: 11, letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "1rem" }}>
              Something went wrong
            </p>
            <h1 style={{ color: "#fff", fontSize: "2.5rem", fontFamily: "Georgia, serif", marginBottom: "1rem", fontWeight: 400 }}>
              Unexpected Error
            </h1>
            <p style={{ color: "rgba(255,255,255,0.35)", marginBottom: "2.5rem", lineHeight: 1.7 }}>
              An unexpected error occurred. Our team has been notified.<br />
              Please try again or contact us if the issue persists.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
              <button
                onClick={reset}
                style={{
                  background: "linear-gradient(135deg, #c9a84c, #e4c97e, #c9a84c)",
                  color: "#0a0a0a",
                  border: "none",
                  padding: "14px 40px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: 280,
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  color: "#c9a84c",
                  textDecoration: "none",
                  fontSize: 14,
                  padding: "14px 40px",
                  border: "1px solid rgba(201,168,76,0.4)",
                  borderRadius: 12,
                  width: "100%",
                  maxWidth: 280,
                  display: "block",
                }}
              >
                Back to Home
              </a>
            </div>

            <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 12, marginTop: "2.5rem" }}>
              Need urgent help?{" "}
              <a href="https://wa.me/34635383712" style={{ color: "rgba(201,168,76,0.5)" }}>
                WhatsApp +34 635 383 712
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
