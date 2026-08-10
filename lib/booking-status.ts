/**
 * Decides what a booking's status becomes when an admin saves the edit form.
 *
 * Kept as a pure function because the rule is subtle and the failure is silent:
 * the form posts every field at once, so the booking's existing driver arrives
 * alongside whatever status the admin picked. Treating that driver as a fresh
 * assignment overwrote the admin's choice and reported success anyway — the
 * status appeared to change and then reverted.
 */

export interface StatusDecision {
  /** What the admin submitted, if anything. */
  submittedStatus?: string | null;
  /** Driver id on the submitted form, if any. */
  submittedDriverId?: string | null;
  /** The booking's status before this save. */
  currentStatus?: string | null;
  /** The booking's driver before this save. */
  currentDriverId?: string | null;
}

/**
 * @returns the status to write, or null to leave the status untouched.
 */
export function resolveBookingStatus({
  submittedStatus,
  submittedDriverId,
  currentStatus,
  currentDriverId,
}: StatusDecision): string | null {
  const adminChoseStatus = Boolean(submittedStatus) && submittedStatus !== currentStatus;
  const isNewDriver = Boolean(submittedDriverId) && submittedDriverId !== currentDriverId;

  // An explicit change always wins. Assigning a driver and completing a journey
  // in the same save is unusual, but the admin said COMPLETED and meant it.
  if (adminChoseStatus) return submittedStatus!;

  // Attaching a driver for the first time moves the booking along by itself,
  // which is what makes the assignment visible to the customer.
  if (isNewDriver) return "DRIVER_ASSIGNED";

  // Re-saving a booking whose driver has not changed: leave the status alone.
  return submittedStatus ?? null;
}
