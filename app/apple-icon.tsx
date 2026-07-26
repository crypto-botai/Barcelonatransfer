import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS "Add to Home Screen" icon. Apple auto-applies its own rounded-square mask,
// so this is intentionally drawn edge-to-edge with no corner radius of its own.
export default function AppleIcon() {
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
            width: 68, height: 68, border: "7px solid #c9a84c",
            transform: "rotate(45deg)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 34, height: 34, background: "#c9a84c" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
