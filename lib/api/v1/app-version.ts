import type { MobilePlatform } from "./types";

/**
 * App version gate.
 *
 * Each platform has a minimum version (anything older must update before it can
 * be used) and a latest version (older ones are nudged). The numbers come from
 * environment variables so they can change without a deploy, and default to
 * "everything allowed" until the first store release exists.
 */

export type VersionVerdict = "ok" | "update_available" | "update_required";

export interface PlatformVersions {
  minimum: string;
  latest: string;
  storeUrl: string | null;
}

export function parseVersion(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** -1, 0 or 1. Unparseable versions sort lowest. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

export function evaluateAppVersion(current: string, versions: PlatformVersions): VersionVerdict {
  if (!parseVersion(current)) return "update_required";
  if (compareVersions(current, versions.minimum) < 0) return "update_required";
  if (compareVersions(current, versions.latest) < 0) return "update_available";
  return "ok";
}

export function platformVersions(platform: MobilePlatform, app: "customer" | "driver", env: Record<string, string | undefined> = process.env): PlatformVersions {
  const key = `MOBILE_${app.toUpperCase()}_${platform.toUpperCase()}`;
  return {
    minimum: env[`${key}_MIN_VERSION`] || "0.0.0",
    latest: env[`${key}_LATEST_VERSION`] || "0.0.0",
    storeUrl: env[`${key}_STORE_URL`] || null,
  };
}
