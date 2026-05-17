import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://elitebcntransfers.com";
  const pages = [
    { url: base,                          priority: 1.0, changeFrequency: "weekly" as const },
    { url: `${base}/fleet`,               priority: 0.9, changeFrequency: "weekly" as const },
    { url: `${base}/pricing`,             priority: 0.9, changeFrequency: "weekly" as const },
    { url: `${base}/airport-transfers`,   priority: 0.9, changeFrequency: "monthly" as const },
    { url: `${base}/corporate`,           priority: 0.8, changeFrequency: "monthly" as const },
    { url: `${base}/hourly`,              priority: 0.8, changeFrequency: "monthly" as const },
    { url: `${base}/about`,               priority: 0.7, changeFrequency: "monthly" as const },
    { url: `${base}/contact`,             priority: 0.7, changeFrequency: "monthly" as const },
    { url: `${base}/book`,                priority: 0.8, changeFrequency: "weekly" as const },
  ];
  return pages.map((p) => ({ ...p, lastModified: new Date() }));
}
