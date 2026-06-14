/**
 * Price integrity checker.
 * Compares a calculated quote against the DB PricingRule for the vehicle class.
 * When the discrepancy exceeds THRESHOLD, it raises an ApprovalItem of type PRICE_FLAG
 * for admin review. The quote shown to the customer is NEVER blocked or changed here
 * — only flagged.
 */

import { prisma } from "@/lib/prisma";

const THRESHOLD = 0.15; // 15 % discrepancy triggers a flag

export interface PriceCheckInput {
  vehicleClass: string;
  calculatedTotal: number;
  distanceKm: number;
  expectedNote?: string; // human-readable context for the admin flag
}

export async function checkPriceIntegrity({
  vehicleClass,
  calculatedTotal,
  distanceKm,
  expectedNote,
}: PriceCheckInput): Promise<void> {
  try {
    const rule = await prisma.pricingRule.findUnique({
      where: { vehicleClass: vehicleClass as never },
    });
    if (!rule || !rule.isActive) return;

    // Rough independent estimate: baseFare + distance × pricePerKm
    const estimate = rule.baseFare + distanceKm * rule.pricePerKm;
    const effective = Math.max(estimate, rule.minimumFare);

    const diff = Math.abs(calculatedTotal - effective) / (effective || 1);
    if (diff < THRESHOLD) return;

    await prisma.approvalItem.create({
      data: {
        agentId: null,
        type: "PRICE_FLAG",
        title: `Price discrepancy: ${vehicleClass} — €${calculatedTotal.toFixed(2)} vs est. €${effective.toFixed(2)}`,
        preview: [
          `Vehicle class : ${vehicleClass}`,
          `Calculated    : €${calculatedTotal.toFixed(2)}`,
          `DB estimate   : €${effective.toFixed(2)}`,
          `Discrepancy   : ${(diff * 100).toFixed(1)}%`,
          `Distance      : ${distanceKm.toFixed(1)} km`,
          expectedNote ? `Note: ${expectedNote}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        diffBefore: `€${effective.toFixed(2)} (DB estimate)`,
        diffAfter: `€${calculatedTotal.toFixed(2)} (calculated)`,
        metadata: { vehicleClass, calculatedTotal, effective, distanceKm, diff },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  } catch {
    // Non-critical — never throw from here
  }
}
