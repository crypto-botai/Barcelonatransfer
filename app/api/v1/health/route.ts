import { apiHandler } from "@/lib/api/v1/response";
import { resolveAppEnvironment } from "@/lib/env-guard";
import { API_VERSION } from "@/lib/api/v1/types";

export const dynamic = "force-dynamic";

/**
 * Is the mobile API up, and which environment is it?
 *
 * Public and free of any database call, so it answers even when the database is
 * down. The environment name lets an app and a person confirm that a build is
 * talking to staging and not production. It reveals nothing else.
 */
export const GET = apiHandler(
  "health",
  async () => ({ status: "ok" as const, apiVersion: API_VERSION, environment: resolveAppEnvironment(), time: new Date().toISOString() }),
  { auth: false },
);
