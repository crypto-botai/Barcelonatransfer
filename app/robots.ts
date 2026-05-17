import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/driver", "/dashboard", "/api"] },
    sitemap: "https://elitebcntransfers.com/sitemap.xml",
  };
}
