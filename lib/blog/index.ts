import type { BlogArticle } from "./types";
import { COAST_ARTICLES }    from "./articles-coast";
import { INLAND_ARTICLES }   from "./articles-inland";
import { SEASONAL_ARTICLES } from "./articles-seasonal";

export * from "./types";

/** Every article, newest first. */
export const BLOG_ARTICLES: BlogArticle[] = [
  ...COAST_ARTICLES,
  ...INLAND_ARTICLES,
  ...SEASONAL_ARTICLES,
].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : a.title.localeCompare(b.title)));

export function getArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

/**
 * Related articles for the footer of an article page: prefer the same season,
 * then the same category, then anything — never the article itself.
 */
export function relatedArticles(current: BlogArticle, limit = 3): BlogArticle[] {
  const others = BLOG_ARTICLES.filter((a) => a.slug !== current.slug);
  const score = (a: BlogArticle) =>
    (a.season === current.season ? 2 : 0) + (a.category === current.category ? 1 : 0);
  return [...others].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export const BLOG_SEASONS = ["All", "Summer", "Winter", "New Year"] as const;
