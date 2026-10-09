import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { POST as websiteQuote } from "@/app/api/quote/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/quotes
 *
 * The price, from the same function the website's booking form uses, so the app
 * and the website cannot disagree. The body is the website's quote request
 * (pickup and drop-off with coordinates, vehicle class, date and time, booking
 * type, hours for hire). The answer is the website's breakdown: base fare,
 * surcharges, last-minute fee, total. The app displays it and never works a
 * price out itself.
 *
 * Public, so a visitor can see a price before creating an account. Limited per
 * address because each quote may call a routing service.
 */
const body = z.record(z.string(), z.unknown());

export const POST = apiHandler(
  "quotes.create",
  async ({ req }) => {
    const input = await parseBody(req, body);
    const { json } = await callLegacy(websiteQuote, { method: "POST", path: "/api/quote", body: input, ip: clientAddress(req) });
    return json;
  },
  { auth: false, rateLimit: "quote" },
);
