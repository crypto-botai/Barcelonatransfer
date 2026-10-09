import { apiHandler } from "@/lib/api/v1/response";
import { getPublicRoutes } from "@/lib/pricing-service";
import { VEHICLES, type VehicleCode } from "@/lib/fixed-prices";

export const dynamic = "force-dynamic";

const CODES: VehicleCode[] = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"];

/**
 * GET /api/v1/routes
 *
 * Every fixed-price route with its price per vehicle class: the table the website
 * shows on /pricing, /book and the home page. It is read from the same function
 * (getPublicRoutes: the database table the admin edits, with the built-in table as
 * the fallback), so a price changed in the admin changes here with no app update.
 *
 * Public, like the website's own price table. A journey that is not in the table is
 * priced by a quote, never by this list. The five columns are the website's price
 * classes; a single car's own fare (a Camry against an E-Class) comes from the quote.
 */
export const GET = apiHandler(
  "routes",
  async () => {
    const routes = await getPublicRoutes();
    return {
      classes: CODES.map((code) => ({ code, label: VEHICLES[code].label, paxLabel: VEHICLES[code].paxLabel, maxPassengers: VEHICLES[code].maxPax })),
      routes: routes
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          id: r.id,
          slug: r.slug,
          label: r.label,
          category: r.category,
          fromKey: r.fromKey,
          toKey: r.toKey,
          note: r.note,
          prices: { ECONOMY: r.economy, BUSINESS: r.business, MINIVAN: r.minivan, VCLASS: r.vclass, MINIBUS: r.minibus },
          // The price table is read through Next's data cache, which hands dates back as ISO text, so accept both.
          updatedAt: new Date(r.updatedAt).toISOString(),
        })),
    };
  },
  { auth: false },
);
