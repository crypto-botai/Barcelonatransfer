import { prisma } from "@/lib/prisma";
import type { ActorUser } from "@/lib/request-session";
import { unauthenticated } from "./errors";
import type { AuthContext } from "./types";

/**
 * The verified caller of a /api/v1 route, as the person the website's handlers
 * expect. Read from the database, not from the token, so the email and name are
 * current. Only call this after authenticate() has verified the bearer token.
 */
export async function actorFor(auth: AuthContext): Promise<ActorUser> {
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { id: true, email: true, name: true, role: true } });
  if (!user || user.role !== auth.role) throw unauthenticated("Sign in again.");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
