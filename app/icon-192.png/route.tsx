import { ImageResponse } from "next/og";

export const dynamic = "force-static";

// Stable /icon-192.png URL referenced from app/manifest.ts (PWA "Add to Home Screen" icon).
export async function GET() {
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
            width: 72, height: 72, border: "7px solid #c9a84c",
            transform: "rotate(45deg)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 36, height: 36, background: "#c9a84c" }} />
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
