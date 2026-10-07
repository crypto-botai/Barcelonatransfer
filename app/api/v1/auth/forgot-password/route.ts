import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseBody } from "@/lib/api/v1/validate";
import { callLegacy } from "@/lib/api/v1/legacy";
import { clientAddress } from "@/lib/api/v1/rate-limit";
import { POST as websiteForgot } from "@/app/api/auth/forgot-password/route";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().trim().min(3).max(254).email() });

/**
 * POST /api/v1/auth/forgot-password
 *
 * Sends the website's reset email. The answer is the same whether or not the
 * address has an account, so this cannot be used to find out who is a customer.
 */
export const POST = apiHandler(
  "auth.forgot",
  async ({ req }) => {
    const input = await parseBody(req, body);
    await callLegacy(websiteForgot, { method: "POST", path: "/api/auth/forgot-password", body: input, ip: clientAddress(req) }).catch(() => undefined);
    return { sent: true };
  },
  { auth: false, rateLimit: "credentials" },
);
