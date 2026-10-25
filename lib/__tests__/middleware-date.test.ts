import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth/jwt", () => ({ getToken: async () => null }));

import { middleware } from "@/middleware";

/**
 * A cached page keeps the Date it was generated with, so the home page reported a time 17 minutes behind the real one and an SEO
 * checker called the server clock wrong. The middleware stamps the time of each request on whatever it returns.
 */
const req = (path: string, host = "www.elitebcn.info") => new NextRequest(`https://${host}${path}`, { headers: { host } });
const seconds = (res: Response) => Math.abs(Date.now() - new Date(res.headers.get("date") ?? 0).getTime()) / 1000;

describe("middleware stamps the current time", () => {
  it("on a page", async () => {
    const res = await middleware(req("/"));
    expect(res.headers.get("date")).toMatch(/GMT$/);
    expect(seconds(res)).toBeLessThan(5);
  });

  it("on a redirect and on a preview host too", async () => {
    expect(seconds(await middleware(req("/", "preview-abc.vercel.app")))).toBeLessThan(5);
    const redirected = await middleware(req("/admin"));
    expect(redirected.status).toBeGreaterThanOrEqual(300);
    expect(seconds(redirected)).toBeLessThan(5);
  });

  it("still keeps the preview host out of search engines", async () => {
    const res = await middleware(req("/", "preview-abc.vercel.app"));
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
