import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DestinationThumb from "@/components/blog/DestinationThumb";
import { BLOG_ARTICLES, readMinutes } from "@/lib/blog";
import { SHARED_OG, BASE_URL, breadcrumbSchema } from "@/lib/seo";
import { ArrowRight, Clock, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Barcelona Travel Guides & Destination Blog | Elite BCN" },
  description:
    "In-depth guides to Barcelona's best day trips: Montserrat, Sitges, the Costa Brava, Girona, Tarragona and Andorra — and when to visit each.",
  alternates: { canonical: `${BASE_URL}/blog` },
  keywords: [
    "barcelona travel blog", "barcelona day trips", "things to do near barcelona",
    "costa brava guide", "barcelona summer guide", "barcelona winter guide",
  ],
  openGraph: {
    ...SHARED_OG,
    type: "website",
    title: "Barcelona Travel Guides & Destination Blog | Elite BCN",
    description: "Guides to Montserrat, Sitges, the Costa Brava, Girona, Tarragona, Andorra and more — with fixed-price transfers to every one.",
    url: `${BASE_URL}/blog`,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Elite BCN — Barcelona Travel Guides" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barcelona Travel Guides & Destination Blog | Elite BCN",
    description: "Guides to Montserrat, Sitges, the Costa Brava, Girona, Tarragona, Andorra and more.",
    images: ["/opengraph-image"],
  },
};

const BREADCRUMB = breadcrumbSchema([
  { name: "Home", url: BASE_URL },
  { name: "Blog", url: `${BASE_URL}/blog` },
]);

const BLOG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": `${BASE_URL}/blog`,
  name: "Elite BCN Travel Guides",
  description: "Destination guides and seasonal travel advice for Barcelona and Catalonia.",
  url: `${BASE_URL}/blog`,
  publisher: { "@type": "Organization", name: "Elite BCN Transfers", url: BASE_URL },
  blogPost: BLOG_ARTICLES.map((a) => ({
    "@type": "BlogPosting",
    headline: a.title,
    description: a.excerpt,
    url: `${BASE_URL}/blog/${a.slug}`,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
  })),
};

const SEASON_STYLE: Record<string, string> = {
  Summer:     "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Winter:     "bg-sky-500/15 text-sky-300 border-sky-500/25",
  "New Year": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "All year": "bg-white/[0.06] text-white/55 border-white/10",
};

export default function BlogIndexPage() {
  const [featured, ...rest] = BLOG_ARTICLES;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BLOG_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB) }} />
      <Navbar />

      <main className="pt-20 bg-[#050505]">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative py-20 sm:py-24 overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_60%_at_50%_0%,rgba(201,168,76,0.08),transparent)]" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <span className="inline-flex items-center gap-3 mb-6">
              <span className="h-px w-8 bg-[#c9a84c]/40" />
              <span className="text-[#c9a84c] text-[11px] tracking-[0.4em] uppercase font-medium">Travel Guides</span>
              <span className="h-px w-8 bg-[#c9a84c]/40" />
            </span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-5">
              Where to Go <span className="text-gold-gradient">Beyond Barcelona</span>
            </h1>
            <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
              Long-form guides to the destinations we drive to every week — what is actually
              worth seeing, when to go, and how to get there without losing half the day.
            </p>
          </div>
        </section>

        {/* ── Featured ─────────────────────────────────────────── */}
        <section className="container mx-auto px-4 py-14">
          <Link
            href={`/blog/${featured.slug}`}
            className="group grid lg:grid-cols-2 gap-8 lg:gap-12 items-center rounded-3xl border border-white/[0.07] bg-[#0b0b0b] overflow-hidden hover:border-[#c9a84c]/30 transition-colors duration-300"
          >
            <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[380px] overflow-hidden">
              <DestinationThumb article={featured} priority sizes="(max-width: 1024px) 100vw, 50vw" />
              <span className="absolute top-5 left-5 z-10 px-3 py-1.5 rounded-full bg-[#c9a84c] text-black text-[10px] font-bold tracking-wide uppercase">
                Latest guide
              </span>
            </div>
            <div className="p-7 lg:p-10">
              <div className="flex items-center gap-2.5 mb-4">
                <span className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${SEASON_STYLE[featured.season]}`}>
                  {featured.season}
                </span>
                <span className="text-white/55 text-xs flex items-center gap-1.5">
                  <Clock size={11} /> {readMinutes(featured)} min read
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-white leading-snug mb-4 group-hover:text-[#c9a84c] transition-colors">
                {featured.title}
              </h2>
              <p className="text-white/70 leading-relaxed mb-6">{featured.excerpt}</p>
              <span className="inline-flex items-center gap-2 text-[#c9a84c] text-sm font-semibold">
                Read the guide
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </section>

        {/* ── Grid ─────────────────────────────────────────────── */}
        <section className="container mx-auto px-4 pb-24">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="font-display text-2xl text-white">All guides</h2>
            <div className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-white/55 text-sm">{BLOG_ARTICLES.length} articles</span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#0b0b0b] overflow-hidden hover:border-[#c9a84c]/30 transition-colors duration-300"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <DestinationThumb article={a} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                  <div className="absolute bottom-4 left-5 right-5 z-10">
                    <span className={`inline-block px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${SEASON_STYLE[a.season]}`}>
                      {a.season}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col flex-1 p-6 gap-3">
                  <h3 className="font-display text-lg text-white leading-snug group-hover:text-[#c9a84c] transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-3 flex-1">{a.excerpt}</p>

                  <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/[0.06]">
                    <span className="text-white/55 text-xs flex items-center gap-1.5">
                      <Clock size={11} /> {readMinutes(a)} min
                    </span>
                    {a.distanceKm ? (
                      <span className="text-white/55 text-xs flex items-center gap-1.5">
                        <MapPin size={11} /> {a.distanceKm} km
                      </span>
                    ) : (
                      <span className="text-white/55 text-xs">In the city</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="border-t border-white/[0.06] py-16 bg-[#080808]">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl text-white mb-4">Ready to go somewhere?</h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">
              Fixed price per vehicle to every destination in these guides, agreed before you travel.
            </p>
            <Link
              href="/book"
              className="inline-flex items-center gap-2 bg-[#c9a84c] hover:bg-[#d4b96a] text-black font-semibold px-8 py-4 rounded-xl transition-colors"
            >
              Book a transfer <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
