import { MetadataRoute } from "next";
import destinations from "@/data/destinations.json";

export const dynamic = "force-dynamic";

const BASE = "https://www.elitebcn.info";

export default function sitemap(): MetadataRoute.Sitemap {
  const NOW = new Date();
  const dynamicPages: MetadataRoute.Sitemap = destinations.map((d) => ({
    url: `${BASE}/transfers/${d.slug}`,
    priority: d.type === "hotel" ? 0.75 : d.type === "cruise" ? 0.8 : d.type === "event" ? 0.8 : 0.85,
    changeFrequency: d.type === "event" ? ("yearly" as const) : ("monthly" as const),
    lastModified: NOW,
  }));

  return [
    // ── Core pages ─────────────────────────────────────
    { url: BASE,                                priority: 1.0,  changeFrequency: "weekly",  lastModified: NOW },
    { url: `${BASE}/book`,                      priority: 0.95, changeFrequency: "weekly",  lastModified: NOW },
    { url: `${BASE}/pricing`,                   priority: 0.9,  changeFrequency: "weekly",  lastModified: NOW },
    { url: `${BASE}/fleet`,                     priority: 0.9,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/airport-transfers`,         priority: 0.9,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/corporate`,                 priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/hourly`,                    priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/faq`,                       priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/about`,                     priority: 0.7,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/contact`,                   priority: 0.7,  changeFrequency: "monthly", lastModified: NOW },

    // ── Service pages ─────────────────────────────────
    { url: `${BASE}/vip-transportation`,             priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/day-tours`,                      priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/hotel-transfers`,                priority: 0.85, changeFrequency: "monthly", lastModified: NOW },

    // ── Tools ─────────────────────────────────────────
    { url: `${BASE}/tools/transfer-cost-calculator`, priority: 0.85, changeFrequency: "monthly", lastModified: NOW },

    // ── Static destination landing pages ───────────────
    { url: `${BASE}/transfers`,                 priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/sitges`,          priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/girona`,          priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/montserrat`,      priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/costa-brava`,     priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/tarragona`,       priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/andorra`,         priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/cruise-port`,     priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/port-aventura`,   priority: 0.75, changeFrequency: "monthly", lastModified: NOW },

    // ── Dynamic programmatic SEO pages (44 destinations) ─
    ...dynamicPages,

    // ── Legal ─────────────────────────────────────────
    { url: `${BASE}/privacy`,                   priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
    { url: `${BASE}/terms`,                     priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
    { url: `${BASE}/cookies`,                   priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
  ];
}
