import { z } from "zod";
import { apiHandler } from "@/lib/api/v1/response";
import { parseQuery } from "@/lib/api/v1/validate";
import { evaluateAppVersion, platformVersions } from "@/lib/api/v1/app-version";
import { ApiError } from "@/lib/api/v1/errors";

export const dynamic = "force-dynamic";

const query = z.object({
  app: z.enum(["customer", "driver"]),
  platform: z.enum(["ios", "android"]),
  version: z.string().min(1).max(32),
});

/**
 * Tells an app, at launch, whether its version may be used.
 *
 * "update_required" makes the app show its update screen instead of the product.
 * The same answer is also returned as UPGRADE_REQUIRED (426) when strict=1, so a
 * client can treat an unsupported version as an error.
 */
export const GET = apiHandler(
  "app-config",
  async ({ req }) => {
    const q = parseQuery(req, query);
    const versions = platformVersions(q.platform, q.app);
    const verdict = evaluateAppVersion(q.version, versions);
    if (verdict === "update_required" && new URL(req.url).searchParams.get("strict") === "1") {
      throw new ApiError("UPGRADE_REQUIRED", "Update the app to continue.");
    }
    return { verdict, minimumVersion: versions.minimum, latestVersion: versions.latest, storeUrl: versions.storeUrl };
  },
  { auth: false },
);
