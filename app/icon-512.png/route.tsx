import { ImageResponse } from "next/og";

export const dynamic = "force-static";

// Stable /icon-512.png URL referenced from app/manifest.ts and layout.tsx Organization JSON-LD logo.
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
            width: 192, height: 192, border: "18px solid #c9a84c",
            transform: "rotate(45deg)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 96, height: 96, background: "#c9a84c" }} />
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
