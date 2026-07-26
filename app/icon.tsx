import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Same gold diamond mark as public/favicon.svg, rendered as PNG for clients that
// don't accept SVG favicons (many Apple/Windows/PWA install surfaces require PNG).
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center", background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: 12, height: 12, border: "1.5px solid #c9a84c",
            transform: "rotate(45deg)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 6, height: 6, background: "#c9a84c" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
