import { MetadataRoute } from "next";

const BASE = "https://www.elitebcn.info";
const NOW  = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
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

    // ── Destination landing pages (local SEO) ──────────
    { url: `${BASE}/transfers`,                 priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/sitges`,          priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/girona`,          priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/montserrat`,      priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/costa-brava`,     priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/tarragona`,       priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/andorra`,         priority: 0.8,  changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/cruise-port`,     priority: 0.85, changeFrequency: "monthly", lastModified: NOW },
    { url: `${BASE}/transfers/port-aventura`,   priority: 0.75, changeFrequency: "monthly", lastModified: NOW },

    // ── Legal ─────────────────────────────────────────
    { url: `${BASE}/privacy`,                   priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
    { url: `${BASE}/terms`,                     priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
    { url: `${BASE}/cookies`,                   priority: 0.3,  changeFrequency: "yearly",  lastModified: NOW },
  ];
}
