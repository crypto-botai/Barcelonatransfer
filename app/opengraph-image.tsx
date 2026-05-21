import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Élite BCN Luxury Airport Transfers Barcelona";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Gold gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.12), transparent)",
          }}
        />
        {/* Top gold line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          }}
        />
        {/* Bottom gold line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #c9a84c, transparent)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            width: 64,
            height: 64,
            border: "2px solid #c9a84c",
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <div style={{ width: 24, height: 24, background: "#c9a84c" }} />
        </div>

        {/* Brand name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "0.25em",
            marginBottom: 24,
          }}
        >
          <span style={{ color: "#ffffff" }}>ÉLITE</span>
          <span style={{ color: "#c9a84c" }}>BCN</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: "#888",
            fontSize: 22,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 48,
          }}
        >
          Luxury Airport Transfers · Barcelona
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 60,
            marginBottom: 48,
          }}
        >
          {[
            { val: "5000+", label: "Transfers" },
            { val: "4.9★", label: "Rating" },
            { val: "24/7", label: "Available" },
            { val: "Fixed", label: "Prices" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ color: "#c9a84c", fontSize: 28, fontWeight: 700 }}>{s.val}</span>
              <span style={{ color: "#666", fontSize: 14, letterSpacing: "0.1em" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            background: "#c9a84c",
            color: "#000",
            padding: "16px 48px",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          Book Online · elitebcn.info
        </div>
      </div>
    ),
    { ...size }
  );
}
