/**
 * Runs once when the server starts (and when a build collects page data).
 *
 * It only carries the staging safety guard. On production the guard checks
 * nothing, so this file changes no production behaviour. See lib/env-guard.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertSafeDatabase } = await import("./lib/env-guard");
    assertSafeDatabase();
  }
}
