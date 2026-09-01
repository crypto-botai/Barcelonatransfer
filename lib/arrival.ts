/**
 * The passenger-reported arrival journey.
 *
 * Between landing and reaching the car there is a stretch of forty minutes or
 * more that nobody can see. Flight data says the aircraft is on stand; it says
 * nothing about whether the passenger is still in the passport queue or already
 * standing at the meeting point. So dispatch calls the passenger, the passenger
 * calls the driver, the driver enters the pickup zone early and waits, and the
 * airport bills for it.
 *
 * The passenger closes that gap themselves. They get a link, they tap where
 * they are, and the driver and the office see it. No app to install and no
 * location tracking — the passenger reports, and nothing is inferred about them
 * that they did not choose to say.
 *
 * ── Why this needs no new table ──
 *
 * Every step is written to ActivityLog, which is already a generic
 * (action, entity, entityId, details, createdAt) event table indexed on entity
 * and createdAt. That is exactly the shape of an arrival timeline, and using it
 * means the whole feature ships without a schema change — this project applies
 * schema changes with `prisma db push` against the live database, which is not
 * something to require for a feature that does not need it.
 *
 * Passenger rows are distinguished by the PAX_ prefix on `action` and by
 * entity "Booking", so they never collide with the admin audit rows already in
 * the table.
 */

export const PAX_STAGES = [
  "LANDED",
  "PASSPORT_CONTROL",
  "WAITING_LUGGAGE",
  "LUGGAGE_COLLECTED",
  "WALKING_TO_MEETING_POINT",
  "AT_MEETING_POINT",
] as const;

export type PaxStage = (typeof PAX_STAGES)[number];

export interface PaxStageMeta {
  /** How the step reads once it has happened. */
  label: string;
  /** The words on the button the passenger taps. */
  action: string;
  /** What the driver and the office should do about it. */
  opsNote: string;
}

export const PAX_STAGE_META: Record<PaxStage, PaxStageMeta> = {
  LANDED: {
    label:   "Landed",
    action:  "I've landed",
    opsNote: "Passenger is off the aircraft.",
  },
  PASSPORT_CONTROL: {
    label:   "Passport control",
    action:  "I'm at passport control",
    opsNote: "Passenger is in the border queue — typically the longest wait.",
  },
  WAITING_LUGGAGE: {
    label:   "Waiting for luggage",
    action:  "I'm waiting for luggage",
    opsNote: "Through the border, at the baggage belt.",
  },
  LUGGAGE_COLLECTED: {
    label:   "Luggage collected",
    action:  "I have my luggage",
    opsNote: "Bags in hand. Roughly ten minutes out.",
  },
  WALKING_TO_MEETING_POINT: {
    label:   "Walking to meeting point",
    action:  "I'm walking to the meeting point",
    opsNote: "Bring the vehicle to the pickup zone now.",
  },
  AT_MEETING_POINT: {
    label:   "At meeting point",
    action:  "I'm at the meeting point",
    opsNote: "Passenger is waiting at the agreed point.",
  },
};

/** Written into ActivityLog.action. */
export const PAX_ACTION_PREFIX = "PAX_";

export function actionForStage(stage: PaxStage): string {
  return `${PAX_ACTION_PREFIX}${stage}`;
}

/** The stage an ActivityLog row refers to, or null if it is not an arrival row. */
export function stageFromAction(action: string): PaxStage | null {
  if (!action.startsWith(PAX_ACTION_PREFIX)) return null;
  const rest = action.slice(PAX_ACTION_PREFIX.length) as PaxStage;
  return PAX_STAGES.includes(rest) ? rest : null;
}

export function stageIndex(stage: PaxStage): number {
  return PAX_STAGES.indexOf(stage);
}

/**
 * The step the passenger would report next.
 *
 * Null once they are at the meeting point, which is the end of the journey
 * this covers — everything after that is the driver's to report.
 */
export function nextPaxStage(current: PaxStage | null): PaxStage | null {
  if (current === null) return PAX_STAGES[0];
  const i = stageIndex(current);
  return i >= 0 && i < PAX_STAGES.length - 1 ? PAX_STAGES[i + 1] : null;
}

export interface PaxEvent {
  stage: PaxStage;
  at: string;
}

/**
 * The furthest point reached.
 *
 * Taken as the highest stage rather than the most recent row, because a
 * passenger who taps "waiting for luggage" after "luggage collected" — easily
 * done on a phone in one hand — has not gone backwards through the airport.
 */
export function furthestStage(events: readonly PaxEvent[]): PaxStage | null {
  let best: PaxStage | null = null;
  for (const e of events) {
    if (best === null || stageIndex(e.stage) > stageIndex(best)) best = e.stage;
  }
  return best;
}

/** The single line the driver and the office should read first. */
export function currentSignal(events: readonly PaxEvent[]): string {
  const stage = furthestStage(events);
  if (!stage) return "Passenger has not reported yet.";
  return PAX_STAGE_META[stage].opsNote;
}

/** Whether the journey has reached its last reportable step. */
export function isComplete(events: readonly PaxEvent[]): boolean {
  return furthestStage(events) === "AT_MEETING_POINT";
}
