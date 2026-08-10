/**
 * Ride stages — where the driver is within a journey that is already underway.
 *
 * The driver taps one button per stage; each tap writes a RideEvent so the
 * operator can reconstruct the whole journey afterwards, and notifies the
 * customer where there is something worth telling them.
 *
 * Deliberately separate from BookingStatus, which drives the booking and
 * payment lifecycle. A journey moving from "arrived" to "waiting" says nothing
 * about whether the booking is paid, and the two should not be able to
 * contradict each other.
 */

import type { RideStage } from "@prisma/client";

export const RIDE_STAGES: RideStage[] = [
  "ON_THE_WAY",
  "ARRIVED",
  "WAITING_PASSENGER",
  "ON_BOARD",
  "COMPLETED",
];

export interface StageMeta {
  /** What the driver taps. */
  action: string;
  /** What the operator reads in the timeline. */
  label: string;
  /** Notification event, or null where telling the customer adds nothing. */
  event: "DRIVER_EN_ROUTE" | "DRIVER_ARRIVED" | "RIDE_ON_BOARD" | "RIDE_COMPLETED" | null;
  tone: "blue" | "amber" | "emerald" | "gold";
}

export const STAGE_META: Record<RideStage, StageMeta> = {
  ON_THE_WAY: {
    action: "On the way",
    label: "Driver set off",
    event: "DRIVER_EN_ROUTE",
    tone: "blue",
  },
  ARRIVED: {
    action: "Arrived",
    label: "Driver at pickup",
    event: "DRIVER_ARRIVED",
    tone: "gold",
  },
  WAITING_PASSENGER: {
    action: "Waiting for passenger",
    label: "Waiting for passenger",
    // The customer is being waited for; a message saying so would nag rather
    // than help. This stage exists for the operator, and to time the wait.
    event: null,
    tone: "amber",
  },
  ON_BOARD: {
    action: "Passenger on board",
    label: "Passenger on board",
    event: "RIDE_ON_BOARD",
    tone: "emerald",
  },
  COMPLETED: {
    action: "Ride completed",
    label: "Journey completed",
    event: "RIDE_COMPLETED",
    tone: "emerald",
  },
};

/**
 * Whether a driver may move from one stage to another.
 *
 * Forward-only, and only by one step. A driver cannot mark a passenger on board
 * before arriving, and cannot silently undo a stage the customer has already
 * been notified about — the notification has gone; the timeline should match
 * what the customer was told.
 */
export function canTransition(from: RideStage | null, to: RideStage): boolean {
  const nextIndex = RIDE_STAGES.indexOf(to);
  if (nextIndex === -1) return false;

  // First tap of the journey must be the first stage.
  if (from === null) return to === "ON_THE_WAY";

  const currentIndex = RIDE_STAGES.indexOf(from);
  if (currentIndex === -1) return false;

  // Waiting is the one stage that can be skipped: a punctual passenger goes
  // straight from arrived to on board.
  if (from === "ARRIVED" && to === "ON_BOARD") return true;

  return nextIndex === currentIndex + 1;
}

/** The stage a driver would tap next, or null once the journey is done. */
export function nextStage(from: RideStage | null): RideStage | null {
  if (from === null) return "ON_THE_WAY";
  const i = RIDE_STAGES.indexOf(from);
  return i === -1 || i === RIDE_STAGES.length - 1 ? null : RIDE_STAGES[i + 1];
}

/** How long the driver waited, in whole minutes, if both stages were recorded. */
export function waitMinutes(arrivedAt?: Date | null, onBoardAt?: Date | null): number | null {
  if (!arrivedAt || !onBoardAt) return null;
  const mins = Math.round((onBoardAt.getTime() - arrivedAt.getTime()) / 60_000);
  return mins >= 0 ? mins : null;
}
