import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * Address autocomplete proxy.
 *
 * The booking form previously called nominatim.openstreetmap.org straight from
 * the browser. That breaks two parts of Nominatim's usage policy: the request
 * carries the visitor's browser User-Agent rather than one identifying this
 * application, and every keystroke from every visitor hits their servers
 * uncached from a different IP. Being blocked would silently break the address
 * field on the booking form.
 *
 * Routing it through here means one identifying User-Agent, a shared cache
 * across all visitors, and serialised requests.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Matches the client's own minimum, and stops a stray empty request from
  // becoming a wildcard search.
  if (q.length < 3) return NextResponse.json({ results: [] });
  if (q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  const results = await searchPlaces(q);

  return NextResponse.json(
    { results },
    {
      // Lets the browser and the CDN absorb repeat typing of the same prefix
      // before it ever reaches the server again.
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    },
  );
}
