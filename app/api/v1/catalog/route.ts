import { apiHandler } from "@/lib/api/v1/response";
import { EXTRAS_CATALOG, FLEET_TO_DB_CLASS, VEHICLE_CATALOG } from "@/types";
import { getFleetFromPrice } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const origin = () => (process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info").replace(/\/$/, "");

/**
 * GET /api/v1/catalog
 *
 * The fleet and the extras, from the same lists the website's booking form uses,
 * so a vehicle or an extra changed on the website changes in the apps with no
 * app update. Public. Prices of journeys are never here: only a quote has them.
 * An extra's own price is listed because the website shows it before any quote.
 */
export const GET = apiHandler(
  "catalog",
  async () => ({
    vehicles: VEHICLE_CATALOG.map((v) => ({
      id: v.class,
      vehicleClass: FLEET_TO_DB_CLASS[v.class],
      name: v.label,
      badge: v.badge ?? null,
      passengers: v.maxPassengers,
      largeBags: v.largeBags,
      mediumBags: v.mediumBags,
      smallBags: v.smallBags,
      features: v.features,
      description: v.description,
      imageUrl: v.image ? `${origin()}${v.image}` : null,
      // The headline "from" price the website shows on its fleet page: airport to the city.
      fromPrice: getFleetFromPrice(v.class),
    })),
    extras: EXTRAS_CATALOG.map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      price: e.price,
      percentOfSubtotal: e.percentOfSubtotal ?? null,
      maxQty: e.maxQty,
      priceLabel: e.priceLabel,
    })),
  }),
  { auth: false },
);
