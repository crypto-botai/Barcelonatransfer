import Image from "next/image";
import type { BlogArticle } from "@/lib/blog";

/**
 * Article artwork.
 *
 * If the article has a real licensed photograph at `photo`, it is used.
 * Otherwise we render generated artwork: a layered gradient built from the
 * article's own accent pair plus a geometric motif matched to the terrain
 * (coast, peaks, arches, city, vines, snow). Every article carries a distinct
 * accent pair, so each card is visually identifiable at a glance without
 * shipping stock photography we do not hold a licence for.
 */
export default function DestinationThumb({
  article,
  priority = false,
  className = "",
  sizes,
}: {
  article: BlogArticle;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [a, b] = article.accent;

  if (article.photo) {
    return (
      <Image
        src={article.photo}
        alt={article.title}
        fill
        priority={priority}
        sizes={sizes ?? "(max-width: 768px) 100vw, 400px"}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: `linear-gradient(145deg, ${a} 0%, #0b0b0b 55%, ${b} 140%)` }}
    >
      {/* Depth wash so text above always has contrast */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 70% at 30% 15%, rgba(255,255,255,0.16), transparent 60%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 55%, transparent 100%)" }} />

      <Motif motif={article.motif} a={a} b={b} />

      {/* Fine gold hairline, consistent with the rest of the site */}
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${b}88, transparent)` }} />
    </div>
  );
}

function Motif({ motif, a, b }: { motif: BlogArticle["motif"]; a: string; b: string }) {
  const common = "absolute inset-0 w-full h-full";

  if (motif === "coast") {
    return (
      <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        <path d="M0 176 Q 60 158 110 172 T 220 168 T 330 176 T 400 168 L400 260 L0 260Z" fill={b} opacity="0.20" />
        <path d="M0 196 Q 70 180 130 194 T 250 190 T 360 198 T 400 192 L400 260 L0 260Z" fill={b} opacity="0.28" />
        <path d="M0 218 Q 80 204 150 216 T 290 214 T 400 220 L400 260 L0 260Z" fill="#000" opacity="0.35" />
        <circle cx="316" cy="62" r="26" fill={b} opacity="0.5" />
      </svg>
    );
  }

  if (motif === "peaks") {
    return (
      <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        <path d="M0 260 L70 128 L112 176 L168 92 L226 178 L272 140 L330 200 L400 150 L400 260Z" fill="#000" opacity="0.42" />
        <path d="M0 260 L92 168 L148 210 L206 152 L268 216 L332 178 L400 232 L400 260Z" fill={b} opacity="0.22" />
        <circle cx="308" cy="58" r="22" fill={b} opacity="0.45" />
      </svg>
    );
  }

  if (motif === "arches") {
    return (
      <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        {[40, 116, 192, 268, 344].map((x, i) => (
          <g key={x} opacity={0.16 + (i % 2) * 0.1}>
            <path d={`M${x} 260 L${x} 150 Q ${x + 26} 108 ${x + 52} 150 L${x + 52} 260Z`} fill={b} />
          </g>
        ))}
        <rect x="0" y="132" width="400" height="5" fill={b} opacity="0.28" />
        <rect x="0" y="240" width="400" height="20" fill="#000" opacity="0.3" />
      </svg>
    );
  }

  if (motif === "city") {
    return (
      <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        {[
          [22, 168, 40], [70, 140, 34], [112, 186, 30], [150, 120, 38],
          [196, 166, 32], [236, 196, 36], [280, 132, 40], [328, 176, 34], [366, 152, 30],
        ].map(([x, y, w]) => (
          <rect key={x} x={x} y={y} width={w} height={260 - y} fill="#000" opacity="0.38" />
        ))}
        <path d="M150 120 L169 88 L188 120Z" fill={b} opacity="0.5" />
        <circle cx="318" cy="56" r="20" fill={b} opacity="0.45" />
      </svg>
    );
  }

  if (motif === "snow") {
    return (
      <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
        <path d="M0 260 L86 116 L134 168 L196 84 L258 172 L318 128 L400 196 L400 260Z" fill="#000" opacity="0.4" />
        <path d="M86 116 L112 154 L60 154Z M196 84 L226 128 L166 128Z M318 128 L340 160 L296 160Z" fill="#fff" opacity="0.55" />
        {[[54, 44], [128, 30], [212, 50], [286, 34], [352, 60], [92, 74], [246, 84]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 2 ? 3 : 2} fill="#fff" opacity="0.6" />
        ))}
      </svg>
    );
  }

  // vines
  return (
    <svg className={common} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M${-20 + i * 78} 260 Q ${10 + i * 78} 178 ${-20 + i * 78} 118`} stroke={b} strokeWidth="3" fill="none" opacity="0.3" />
      ))}
      <path d="M0 214 Q 100 198 200 214 T 400 214 L400 260 L0 260Z" fill="#000" opacity="0.36" />
      <circle cx="322" cy="60" r="22" fill={a} opacity="0.5" />
    </svg>
  );
}
