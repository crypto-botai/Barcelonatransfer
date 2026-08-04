/**
 * Blog content model.
 *
 * Articles are authored as structured blocks rather than raw HTML so that the
 * heading hierarchy (h2 → h5) is enforceable, the word count is computable at
 * build time, and every article renders with identical typography.
 */

export type Block =
  | { type: "h2";      text: string }
  | { type: "h3";      text: string }
  | { type: "h4";      text: string }
  | { type: "h5";      text: string }
  | { type: "p";       text: string }
  | { type: "ul";      items: string[] }
  | { type: "callout"; title: string; text: string };

/**
 * Attribution for a freely-licensed photograph. CC BY and CC BY-SA both
 * require the author, the licence and a link back to the source, so all three
 * are mandatory here rather than optional.
 */
export interface PhotoCredit {
  author:  string;
  licence: string;
  /** Commons file description page. */
  source:  string;
}

export type BlogCategory = "Destination" | "Seasonal" | "Guide";
export type Season = "Summer" | "Winter" | "New Year" | "All year";

export interface BlogArticle {
  slug:            string;
  /** Rendered as the page <h1>. */
  title:           string;
  /** One-line hook used on cards and as the fallback meta description. */
  excerpt:         string;
  metaTitle:       string;
  metaDescription: string;
  keywords:        string[];

  category: BlogCategory;
  season:   Season;

  publishedAt: string; // ISO date
  updatedAt:   string; // ISO date

  /**
   * Two brand-compatible hex accents used to generate this article's unique
   * thumbnail and social image. Every article gets a distinct pair so cards
   * are visually identifiable at a glance.
   */
  accent: [string, string];
  /** Geometric motif variant for the generated artwork. */
  motif: "coast" | "peaks" | "arches" | "city" | "vines" | "snow";

  /**
   * Real photograph served from /public (e.g. "/blog/sitges.jpg"). When set it
   * replaces the generated artwork everywhere. Populated from freely-licensed
   * Wikimedia Commons photographs of the actual destination — see `credit`,
   * which must be rendered wherever the photo is, to satisfy the CC BY /
   * CC BY-SA attribution requirement.
   */
  photo?: string;
  credit?: PhotoCredit;

  /** Free-text place name passed to /book?destination= */
  bookDestination: string;
  /** Existing transfer page for this destination, when one exists. */
  transferHref?: string;
  /**
   * Zone key from lib/pricing (e.g. "sitges"). When set, the booking CTA
   * resolves a live "from" price out of the real fixed-price matrix instead
   * of hardcoding one that would drift.
   */
  priceZone?: string;

  distanceKm?:  number;
  durationMin?: number;

  body: Block[];
}

/** Plain-text length of a block, for word counting. */
function blockText(b: Block): string {
  switch (b.type) {
    case "ul":      return b.items.join(" ");
    case "callout": return `${b.title} ${b.text}`;
    default:        return b.text;
  }
}

/** Total words across every block plus the title. Computed, never hardcoded. */
export function wordCount(a: BlogArticle): number {
  const text = [a.title, ...a.body.map(blockText)].join(" ");
  return text
    .replace(/\*\*/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Reading time at a conservative 200 wpm, floored at 1 minute. */
export function readMinutes(a: BlogArticle): number {
  return Math.max(1, Math.round(wordCount(a) / 200));
}
