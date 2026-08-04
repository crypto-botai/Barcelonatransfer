import { ImageResponse } from "next/og";
import { BLOG_ARTICLES, getArticle } from "@/lib/blog";

export const alt = "Élite BCN Travel Guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

/**
 * Per-article social image, generated from the article's own accent pair so
 * every guide shares a distinct card when linked on social or in chat.
 */
export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);

  const [c1, c2] = a?.accent ?? ["#c9a84c", "#0a0a0a"];
  const title    = a?.title ?? "Élite BCN Travel Guides";
  const season   = a?.season ?? "Barcelona";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(140deg, ${c1} 0%, #0a0a0a 58%, ${c2} 145%)`,
          fontFamily: "serif",
          padding: 64,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.10))" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
          <div style={{ width: 38, height: 38, border: "2px solid #c9a84c", transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 14, background: "#c9a84c" }} />
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "0.22em" }}>
            <span style={{ color: "#fff" }}>ÉLITE</span>
            <span style={{ color: "#c9a84c" }}>BCN</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative", maxWidth: 980 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "#c9a84c",
              color: "#000",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              padding: "8px 20px",
              marginBottom: 26,
            }}
          >
            {season} Guide
          </div>
          <div style={{ color: "#fff", fontSize: title.length > 46 ? 62 : 74, fontWeight: 700, lineHeight: 1.1 }}>
            {title}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 22, letterSpacing: "0.08em" }}>
            elitebcn.info/blog
          </div>
          <div style={{ color: "#c9a84c", fontSize: 22, letterSpacing: "0.08em" }}>
            Fixed-price private transfers
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
