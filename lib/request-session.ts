import { AsyncLocalStorage } from "node:async_hooks";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Who is making this request: the website's cookie session, or a mobile caller.
 *
 * The website's routes hold the booking, cancellation, ride and tracking rules
 * and read the caller with getServerSession. Rewriting those rules for the apps
 * would give the business two engines. Instead a /api/v1 route authenticates the
 * bearer token itself and then runs the existing handler inside runAsActor, and
 * the handler's one line `getRequestSession()` returns that person.
 *
 * Safety:
 *   - Only code under app/api/v1 may call runAsActor, and only after verifying a
 *     bearer token. A test fails if any other file imports it.
 *   - The actor lives in AsyncLocalStorage, scoped to that one call. A website
 *     request never has one, so it behaves exactly as before.
 *   - The value is never read from a header, cookie or body.
 */

export interface ActorUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
}

const actor = new AsyncLocalStorage<ActorUser>();

export function runAsActor<T>(user: ActorUser, fn: () => Promise<T>): Promise<T> {
  return actor.run(user, fn);
}

/** The session the website's handlers use: a mobile actor when there is one, otherwise the cookie session. */
export async function getRequestSession(): Promise<Session | null> {
  const a = actor.getStore();
  if (a) return { user: a, expires: new Date(Date.now() + 15 * 60_000).toISOString() } as unknown as Session;
  return getServerSession(authOptions);
}
