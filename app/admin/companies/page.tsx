import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Building2, Users, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/auth/login");

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true, costCentres: true } },
    },
  });

  // This month's billable total per company, in one query rather than per row.
  const totals = await prisma.booking.groupBy({
    by: ["companyId"],
    where: {
      companyId:      { not: null },
      isDeleted:      false,
      status:         "COMPLETED",
      paymentStatus:  "PAID",
      pickupDatetime: { gte: monthStart },
    },
    _sum:   { totalAmount: true },
    _count: { _all: true },
  });
  const byCompany = new Map(totals.map((t) => [t.companyId, t]));

  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-white font-semibold text-lg">Corporate accounts</h1>
        <p className="text-dark-400 text-sm mt-0.5">
          Companies that settle monthly instead of paying per ride.
        </p>
      </header>

      {companies.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/[0.06]">
          <Building2 size={28} className="text-dark-500 mx-auto mb-3" />
          <p className="text-white font-medium">No corporate accounts yet</p>
          <p className="text-dark-400 text-sm mt-1 max-w-md mx-auto leading-relaxed">
            Add a company to give a client agreed rates, cost-centre reporting and one monthly
            statement instead of a card payment per journey.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((c) => {
            const t = byCompany.get(c.id);
            return (
              <div key={c.id} className="glass-card rounded-xl p-4 border border-white/[0.06]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{c.name}</p>
                      {!c.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-dark-400 border border-white/[0.1]">
                          INACTIVE
                        </span>
                      )}
                      {c.discountPct > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          −{c.discountPct}%
                        </span>
                      )}
                    </div>
                    <p className="text-dark-500 text-xs mt-0.5">
                      {c.billingEmail}
                      {c.taxId ? ` · ${c.taxId}` : " · no tax ID on file"}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-dark-500">
                      <span className="flex items-center gap-1"><Users size={10} /> {c._count.members} member{c._count.members === 1 ? "" : "s"}</span>
                      <span>{c._count.costCentres} cost centre{c._count.costCentres === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-gold-400 font-semibold tabular-nums">
                      €{(t?._sum.totalAmount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-dark-500 text-[11px]">
                      {t?._count._all ?? 0} journey{(t?._count._all ?? 0) === 1 ? "" : "s"} · {monthLabel}
                    </p>
                    <Link
                      href={`/admin/companies/${c.id}/statement`}
                      className="inline-flex items-center gap-1 text-[11px] text-gold-400 hover:text-gold-300 mt-1.5"
                    >
                      <Receipt size={11} /> Statement
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
