/**
 * Corporate accounts.
 *
 * A company books travel for its staff and settles monthly instead of paying
 * per ride. Three things follow from that: members have roles, journeys carry a
 * cost centre so the finance team can split the bill, and a statement collects
 * a month's journeys into one document.
 */

import { prisma } from "@/lib/prisma";
import type { CompanyRole } from "@prisma/client";

export interface Membership {
  companyId: string;
  companyName: string;
  role: CompanyRole;
  discountPct: number;
}

/** The company this user books for, or null for an ordinary retail customer. */
export async function getMembership(userId: string): Promise<Membership | null> {
  const member = await prisma.companyMember.findFirst({
    where:   { userId, company: { active: true } },
    include: { company: { select: { id: true, name: true, discountPct: true } } },
  });
  if (!member) return null;

  return {
    companyId:   member.company.id,
    companyName: member.company.name,
    role:        member.role,
    discountPct: member.company.discountPct,
  };
}

/** BOOKER and ADMIN see the whole company's travel; a TRAVELLER sees only their own. */
export function canSeeAllBookings(role: CompanyRole): boolean {
  return role === "BOOKER" || role === "ADMIN";
}

/** Only a company ADMIN manages members, cost centres and billing. */
export function canManageCompany(role: CompanyRole): boolean {
  return role === "ADMIN";
}

/**
 * Applies an agreed corporate discount to a published fare.
 *
 * Deliberately a separate step applied after the pricing engine rather than a
 * branch inside it: the fixed table stays the single source of truth for what a
 * journey costs, and the discount is visibly a discount rather than a different
 * price. Clamped to 0-100 so a bad value cannot produce a negative fare.
 */
export function applyCorporateDiscount(fare: number, discountPct: number): number {
  const pct = Math.min(100, Math.max(0, discountPct));
  if (pct === 0) return fare;
  return Math.round(fare * (1 - pct / 100) * 100) / 100;
}

export interface StatementLine {
  bookingId: string;
  code: string;
  date: Date;
  traveller: string;
  route: string;
  costCentre: string | null;
  net: number;
}

export interface Statement {
  companyId: string;
  companyName: string;
  year: number;
  month: number;               // 1-12
  lines: StatementLine[];
  net: number;
  vat: number;
  gross: number;
  /** Totals per cost centre, for splitting the bill internally. */
  byCostCentre: Array<{ code: string; label: string; net: number; journeys: number }>;
}

/**
 * A month of completed, paid journeys for one company.
 *
 * Only COMPLETED and PAID journeys appear. Billing for a ride that was
 * cancelled, or that has not been paid for, would put the finance team in the
 * position of disputing their own statement.
 */
export async function buildStatement(
  companyId: string,
  year: number,
  month: number,
  vatRate = 10,
): Promise<Statement | null> {
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) return null;

  const from = new Date(Date.UTC(year, month - 1, 1));
  const to   = new Date(Date.UTC(year, month, 1));

  const [bookings, centres] = await Promise.all([
    prisma.booking.findMany({
      where: {
        companyId,
        isDeleted:      false,
        status:         "COMPLETED",
        paymentStatus:  "PAID",
        pickupDatetime: { gte: from, lt: to },
      },
      orderBy: { pickupDatetime: "asc" },
      select: {
        id: true, confirmationCode: true, pickupDatetime: true,
        pickupAddress: true, dropoffAddress: true,
        guestName: true, totalAmount: true, costCentreCode: true,
      },
    }),
    prisma.costCentre.findMany({
      where:  { companyId },
      select: { code: true, label: true },
    }),
  ]);

  const labels = new Map(centres.map((c) => [c.code, c.label]));

  const lines: StatementLine[] = bookings.map((b) => ({
    bookingId:  b.id,
    code:       b.confirmationCode.slice(0, 8).toUpperCase(),
    date:       b.pickupDatetime,
    traveller:  b.guestName ?? "—",
    route:      `${b.pickupAddress} → ${b.dropoffAddress}`,
    costCentre: b.costCentreCode,
    net:        b.totalAmount,
  }));

  const net   = Math.round(lines.reduce((s, l) => s + l.net, 0) * 100) / 100;
  const vat   = Math.round(net * (vatRate / 100) * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;

  // Journeys with no cost centre are grouped under "Unassigned" rather than
  // dropped, so the parts always add up to the statement total.
  const buckets = new Map<string, { net: number; journeys: number }>();
  for (const l of lines) {
    const key = l.costCentre ?? "";
    const cur = buckets.get(key) ?? { net: 0, journeys: 0 };
    cur.net += l.net;
    cur.journeys += 1;
    buckets.set(key, cur);
  }

  const byCostCentre = [...buckets.entries()]
    .map(([code, v]) => ({
      code:     code || "—",
      label:    code ? labels.get(code) ?? code : "Unassigned",
      net:      Math.round(v.net * 100) / 100,
      journeys: v.journeys,
    }))
    .sort((a, b) => b.net - a.net);

  return { companyId, companyName: company.name, year, month, lines, net, vat, gross, byCostCentre };
}
