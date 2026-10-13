import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LiveFleetMap from "@/components/admin/LiveFleetMap";

export const dynamic = "force-dynamic";

/** Live fleet: every ride under way on one map. ADMIN only, checked here and again by the data endpoint. */
export default async function LiveFleetPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") redirect("/auth/login");
  return <LiveFleetMap />;
}
