import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface ChatAdmin { id: string; name: string }

/**
 * The signed-in office user, or null. Chat access is ADMIN only: no other role (customer, driver, fleet partner) can reach any admin
 * chat route, and there is no separate staff role below ADMIN yet.
 */
export async function requireAdmin(): Promise<ChatAdmin | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string; name?: string | null } | undefined;
  if (!u?.id || u.role !== "ADMIN") return null;
  return { id: u.id, name: u.name ?? "Admin" };
}

/** Every admin chat action is recorded with who did it. Message text is never put in the log. */
export async function chatAudit(admin: ChatAdmin, action: string, bookingId: string | null, details: Record<string, unknown> = {}, ip?: string): Promise<void> {
  try {
    await prisma.activityLog.create({ data: { adminId: admin.id, adminName: admin.name, action, entity: "booking", entityId: bookingId ?? undefined, ip, details: details as object } });
  } catch {
    // A failed audit write must not break the office's reply.
  }
}
