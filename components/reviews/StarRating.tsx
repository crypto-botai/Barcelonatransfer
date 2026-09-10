/**
 * Star ratings drawn from one path definition instead of one per star.
 *
 * The homepage was emitting 105 separate <svg> elements for its review stars —
 * every one carrying the full lucide star path, 624 bytes each, 64 KB in
 * total. That was 21% of a 305 KB HTML document spent re-sending the same
 * shape a hundred times, and it is sent on every request because markup is not
 * cached the way a static asset is.
 *
 * The shape is now declared once per page in <StarSprite />, and each rating is
 * a single <svg> holding N <use> references — roughly 400 bytes for a
 * five-star row rather than 3,120.
 *
 * Deliberately not an <img> or a CSS background: the stars carry the rating,
 * and an assistive technology needs to hear "Rated 5 out of 5" rather than
 * find five decorative images. The row is one labelled role="img", which is
 * also what a screen reader wants — five separate star graphics announced in
 * sequence is noise.
 */

const STAR_PATH =
  "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z";

/**
 * The shape itself. Render once, high in the tree, on any page that shows a
 * rating. Zero-sized and hidden, so it occupies no layout and is never read.
 */
export function StarSprite() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <symbol id="es-star" viewBox="0 0 24 24">
        <path
          d={STAR_PATH}
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
    </svg>
  );
}

/**
 * One row of stars. `count` is how many are lit; `outOf` is the scale, which is
 * what the label says even when only four stars are drawn.
 */
export default function StarRating({
  count,
  size = 14,
  gap = 2,
  outOf = 5,
  className = "",
}: {
  count: number;
  size?: number;
  gap?: number;
  outOf?: number;
  className?: string;
}) {
  const n = Math.max(0, Math.min(count, outOf));
  const stars = Array.from({ length: n }, (_, i) => i);
  const width = n * size + Math.max(0, n - 1) * gap;

  if (n === 0) return null;

  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      role="img"
      aria-label={`Rated ${count} out of ${outOf}`}
      className={className}
      focusable="false"
    >
      {stars.map((i) => (
        <use key={i} href="#es-star" x={i * (size + gap)} y={0} width={size} height={size} />
      ))}
    </svg>
  );
}
