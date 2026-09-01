import { prisma } from "@/lib/prisma";
import {
  PAX_ACTION_PREFIX,
  actionForStage,
  stageFromAction,
  stageIndex,
  type PaxEvent,
  type PaxStage,
} from "@/lib/arrival";

/**
 * Reading and writing the arrival timeline.
 *
 * Backed by ActivityLog — see the note at the top of lib/arrival.ts for why
 * there is no dedicated table. Everything here filters on
 * entity = "Booking" plus the PAX_ action prefix, so these rows and the admin
 * audit rows share a table without ever being mistaken for one another.
 */

const ENTITY = "Booking";

export async function readArrival(bookingId: string): Promise<PaxEvent[]> {
  const rows = await prisma.activityLog.findMany({
    where: {
      entity:   ENTITY,
      entityId: bookingId,
      action:   { startsWith: PAX_ACTION_PREFIX },
    },
    orderBy: { createdAt: "asc" },
    select:  { action: true, createdAt: true },
  });

  const out: PaxEvent[] = [];
  for (const r of rows) {
    const stage = stageFromAction(r.action);
    // A row whose action no longer maps to a stage is from an older or newer
    // version of the journey. Skipping it is better than rendering a blank step.
    if (stage) out.push({ stage, at: r.createdAt.toISOString() });
  }
  return out;
}

/** Timelines for many bookings at once, for the driver and admin lists. */
export async function readArrivalMany(
  bookingIds: readonly string[],
): Promise<Record<string, PaxEvent[]>> {
  if (bookingIds.length === 0) return {};

  const rows = await prisma.activityLog.findMany({
    where: {
      entity:   ENTITY,
      entityId: { in: [...bookingIds] },
      action:   { startsWith: PAX_ACTION_PREFIX },
    },
    orderBy: { createdAt: "asc" },
    select:  { entityId: true, action: true, createdAt: true },
  });

  const out: Record<string, PaxEvent[]> = {};
  for (const r of rows) {
    const stage = stageFromAction(r.action);
    if (!stage || !r.entityId) continue;
    (out[r.entityId] ??= []).push({ stage, at: r.createdAt.toISOString() });
  }
  return out;
}

/**
 * Records a step, and returns the timeline as it now stands.
 *
 * A repeated tap on a step already reported is a no-op rather than a second
 * row: phones double-fire, people re-open the link, and a timeline that says
 * "waiting for luggage" three times is harder to read, not more accurate.
 *
 * Reporting a step behind one already reached is also ignored. The passenger
 * has not walked back through passport control; they have mis-tapped, and the
 * office should not see the journey appear to reverse.
 */
export async function recordArrival(
  bookingId: string,
  stage: PaxStage,
  passengerName?: string | null,
): Promise<{ events: PaxEvent[]; recorded: boolean }> {
  const existing = await readArrival(bookingId);

  const already = existing.some((e) => e.stage === stage);
  const furthest = existing.reduce<number>(
    (max, e) => Math.max(max, stageIndex(e.stage)),
    -1,
  );

  if (already || stageIndex(stage) < furthest) {
    return { events: existing, recorded: false };
  }

  await prisma.activityLog.create({
    data: {
      action:    actionForStage(stage),
      entity:    ENTITY,
      entityId:  bookingId,
      // Named so the row reads sensibly in the admin audit view, where every
      // other row was written by a member of staff.
      adminName: passengerName ? `Passenger · ${passengerName}` : "Passenger",
      details:   { source: "passenger-link", stage },
    },
  });

  return {
    events: [...existing, { stage, at: new Date().toISOString() }],
    recorded: true,
  };
}
