import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ToastHost from "@/components/layout/ToastHost";
import PartnerShell from "@/components/partner/PartnerShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The fleet partner panel.
 *
 * A separate world from /admin: its own shell, its own navigation, nothing
 * that links into the office. The middleware already keeps other roles out;
 * this checks again and loads the company so every page has its name.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!session || user?.role !== "PARTNER" || !user.id) redirect("/auth/login?callbackUrl=/partner");

  const partner = await prisma.fleetPartner.findUnique({
    where: { userId: user.id },
    select: { name: true, contactName: true, active: true },
  });
  if (!partner) redirect("/auth/login");

  // Not yet activated by the office, or suspended: the panel is shown with a
  // banner and nothing can be dispatched; the APIs refuse writes meanwhile.
  return (
    <PartnerShell company={partner.name} contact={partner.contactName} suspended={!partner.active}>
      {children}
      <ToastHost />
    </PartnerShell>
  );
}
