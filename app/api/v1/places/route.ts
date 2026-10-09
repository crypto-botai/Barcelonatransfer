import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseQuery } from "@/lib/api/v1/validate";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { GET as websiteSearch } from "@/app/api/geo/search/route";

export const dynamic = "force-dynamic";

const query = z.object({ q: z.string().trim().min(2).max(200) });

/**
 * GET /api/v1/places?q=
 *
 * Address suggestions from the website's own place search (airports, stations,
 * ports, hotels and streets, with coordinates). Public, and limited per address
 * because each search can reach a geocoder.
 */
export const GET = apiHandler(
  "places",
  async ({ req }) => {
    const { q } = parseQuery(req, query);
    const { json } = await callLegacy(websiteSearch, { method: "GET", path: `/api/geo/search?q=${encodeURIComponent(q)}`, ip: clientAddress(req) });
    return { results: Array.isArray(json.results) ? json.results : [] };
  },
  { auth: false, rateLimit: "quote" },
);
