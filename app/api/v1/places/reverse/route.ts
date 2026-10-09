import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseQuery } from "@/lib/api/v1/validate";
import { ApiError } from "@/lib/api/v1/errors";
import { reversePlace } from "@/lib/geo";

export const dynamic = "force-dynamic";

// Where the business drives: Spain and Andorra, with a margin. The website's own search is clipped the same way.
const query = z.object({
  lat: z.coerce.number().min(35.5).max(44.5),
  lng: z.coerce.number().min(-9.8).max(4.6),
});

/**
 * GET /api/v1/places/reverse?lat=&lng=
 *
 * The address at a point the person chose on the map. Public, limited per address like the other place routes, because
 * each call can reach a geocoder. The answer keeps the chosen point: it is what the booking carries.
 */
export const GET = apiHandler(
  "places-reverse",
  async ({ req }) => {
    const { lat, lng } = parseQuery(req, query);
    const place = await reversePlace(lat, lng);
    if (!place) throw new ApiError("NOT_FOUND", "We could not find an address there. Move the pin a little.");
    return { place };
  },
  { auth: false, rateLimit: "quote" },
);
