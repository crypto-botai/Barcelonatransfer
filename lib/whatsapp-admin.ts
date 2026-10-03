import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** The signed-in admin, or null. Every WhatsApp admin route starts here. */
export async function requireAdmin(): Promise<{ name: string } | null> {
  const s = await getServerSession(authOptions);
  const u = s?.user as { role?: string; name?: string | null } | undefined;
  return u?.role === "ADMIN" ? { name: u.name ?? "Office" } : null;
}
