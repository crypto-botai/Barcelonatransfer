import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DestinationThumb from "@/components/blog/DestinationThumb";
import { BLOG_ARTICLES, getArticle, relatedArticles, readMinutes, type Block } from "@/lib/blog";
import { lookupFixedPriceByZone } from "@/lib/pricing";
import { SHARED_OG, BASE_URL, breadcrumbSchema } from "@/lib/seo";
import { ArrowRight, Clock, MapPin, Calendar, ChevronRight, Info } from "lucide-react";

export function generateStaticParams() {
  return BLOG_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Guide not found | Elite BCN" };

  const url = `${BASE_URL}/blog/${a.slug}`;
  return {
    title: { absolute: a.metaTitle },
    description: a.metaDescription,
    alternates: { canonical: url },
    keywords: a.keywords,
    openGraph: {
      ...SHARED_OG,
      type: "article",
      title: a.metaTitle,
      description: a.metaDescription,
      url,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: a.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: a.metaTitle,
      description: a.metaDescription,
      images: [`${url}/opengraph-image`],
    },
  };
}

/** Minimal inline formatter: **bold** and *italic*, nothing else. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
        if (/^\*[^*]+\*$/.test(p))     return <em key={i} className="text-white/70 italic">{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="font-display text-2xl sm:text-3xl text-white mt-14 mb-5 scroll-mt-24 leading-snug">
          {block.text}
        </h2>
      );
    case "h3":
      return <h3 className="font-display text-xl sm:text-2xl text-white mt-10 mb-4 leading-snug">{block.text}</h3>;
    case "h4":
      return <h4 className="text-base font-semibold text-[#c9a84c] mt-8 mb-3">{block.text}</h4>;
    case "h5":
      return (
        <h5 className="text-[11px] font-bold text-white/45 uppercase tracking-[0.18em] mt-8 mb-2">
          {block.text}
        </h5>
      );
    case "p":
      return <p className="text-white/60 leading-[1.8] mb-5"><RichText text={block.text} /></p>;
    case "ul":
      return (
        <ul className="mb-6 space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-white/60 leading-[1.75]">
              <span className="mt-[0.6rem] w-1.5 h-1.5 rounded-full bg-[#c9a84c]/60 flex-shrink-0" />
              <span><RichText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <aside className="my-10 rounded-2xl border border-[#c9a84c]/25 bg-[#c9a84c]/[0.05] p-6">
          <div className="flex items-center gap-2 mb-2">
            <Info size={15} className="text-[#c9a84c]" />
            <p className="text-[#c9a84c] font-semibold text-sm">{block.title}</p>
          </div>
          <p className="text-white/55 text-sm leading-relaxed"><RichText text={block.text} /></p>
        </aside>
      );
  }
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = relatedArticles(article);
  const url = `${BASE_URL}/blog/${article.slug}`;

  // Live "from" price out of the real fixed-price matrix, so it can never drift
  // away from what the booking engine actually quotes.
  const fromPrice = article.priceZone
    ? lookupFixedPriceByZone("airport", article.priceZone, "ECONOMY")
    : null;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription,
    image: `${url}/opengraph-image`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author:    { "@type": "Organization", name: "Elite BCN Transfers", url: BASE_URL },
    publisher: { "@type": "Organization", name: "Elite BCN Transfers", url: BASE_URL },
    keywords: article.keywords.join(", "),
  };

  const BREADCRUMB = breadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Blog", url: `${BASE_URL}/blog` },
    { name: article.title, url },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />

      <main className="pt-20 bg-[#050505]">
        {/* ── Header ───────────────────────────────────────────── */}
        <article>
          <header className="container mx-auto px-4 pt-12 pb-8 max-w-3xl">
            <nav className="flex items-center gap-2 text-sm mb-7" aria-label="Breadcrumb">
              <Link href="/blog" className="text-white/35 hover:text-[#c9a84c] transition-colors">Guides</Link>
              <ChevronRight size={13} className="text-white/20" />
              <span className="text-[#c9a84c] truncate">{article.season}</span>
            </nav>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white leading-[1.15] mb-6">
              {article.title}
            </h1>

            <p className="text-white/50 text-lg leading-relaxed mb-7">{article.excerpt}</p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/35 pb-8 border-b border-white/[0.07]">
              <span className="flex items-center gap-1.5">
                <Calendar size={12} />
                <time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </time>
              </span>
              <span className="flex items-center gap-1.5"><Clock size={12} /> {readMinutes(article)} min read</span>
              {article.distanceKm ? (
                <span className="flex items-center gap-1.5"><MapPin size={12} /> {article.distanceKm} km from Barcelona</span>
              ) : null}
            </div>
          </header>

          {/* ── Hero artwork ───────────────────────────────────── */}
          <div className="container mx-auto px-4 max-w-4xl mb-12">
            <div className="relative aspect-[21/9] rounded-2xl overflow-hidden border border-white/[0.07]">
              <DestinationThumb article={article} priority sizes="(max-width: 1024px) 100vw, 900px" />
            </div>
            {article.credit && (
              <p className="text-white/25 text-[11px] mt-2.5 text-right">
                Photo:{" "}
                <a
                  href={article.credit.source}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="hover:text-white/45 underline underline-offset-2 transition-colors"
                >
                  {article.credit.author}
                </a>{" "}
                · {article.credit.licence} via Wikimedia Commons
              </p>
            )}
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div className="container mx-auto px-4 max-w-3xl pb-4">
            {article.body.map((block, i) => (
              <BlockRenderer key={i} block={block} />
            ))}
          </div>

          {/* ── Book this place ────────────────────────────────── */}
          <div className="container mx-auto px-4 max-w-3xl py-12">
            <div className="rounded-3xl border border-[#c9a84c]/30 bg-gradient-to-br from-[#c9a84c]/[0.09] to-transparent p-8 sm:p-10">
              <span className="text-[#c9a84c] text-[11px] tracking-[0.3em] uppercase font-semibold">Get there</span>
              <h2 className="font-display text-2xl sm:text-3xl text-white mt-3 mb-3">
                Book your transfer to {article.bookDestination}
              </h2>
              <p className="text-white/50 leading-relaxed mb-6">
                Private, door-to-door, with a fixed price agreed before you travel.
                {fromPrice ? <> From <strong className="text-[#c9a84c] font-semibold">€{fromPrice}</strong> per vehicle from El Prat Airport, excluding VAT and tolls.</> : null}
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/book?destination=${encodeURIComponent(article.bookDestination)}`}
                  className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#d4b96a] text-black font-semibold px-7 py-3.5 rounded-xl transition-colors"
                >
                  Book This Place <ArrowRight size={16} />
                </Link>
                {article.transferHref && (
                  <Link
                    href={article.transferHref}
                    className="inline-flex items-center gap-2 border border-[#c9a84c]/30 text-[#c9a84c] hover:border-[#c9a84c]/60 px-7 py-3.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    See route &amp; prices
                  </Link>
                )}
              </div>
            </div>
          </div>
        </article>

        {/* ── Related ──────────────────────────────────────────── */}
        {related.length > 0 && (
          <section className="border-t border-white/[0.06] py-16">
            <div className="container mx-auto px-4 max-w-5xl">
              <h2 className="font-display text-2xl text-white mb-8">Keep reading</h2>
              <div className="grid sm:grid-cols-3 gap-6">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="group rounded-2xl border border-white/[0.07] bg-[#0b0b0b] overflow-hidden hover:border-[#c9a84c]/30 transition-colors"
                  >
                    <div className="relative aspect-[16/10]">
                      <DestinationThumb article={r} sizes="(max-width: 640px) 100vw, 33vw" />
                    </div>
                    <div className="p-5">
                      <h3 className="text-white text-sm font-semibold leading-snug group-hover:text-[#c9a84c] transition-colors mb-2">
                        {r.title}
                      </h3>
                      <span className="text-white/30 text-xs flex items-center gap-1.5">
                        <Clock size={11} /> {readMinutes(r)} min read
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
