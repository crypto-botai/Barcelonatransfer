import { z } from "zod";
import { ApiError } from "./errors";

/**
 * Checks on a GPS fix before it is kept, shared by the driver's and the passenger's position endpoints.
 *
 * A phone can send an old fix it queued while offline, a fix with a wide error circle (a cell-tower guess), a fix with a clock that
 * is wrong, or the 0,0 "no position" value. None of those should move a car on someone's map, so they are refused here, on the
 * server, whatever the app did. `accuracy` (metres) and `at` (milliseconds since 1970, when the phone took the fix) are optional so
 * older app builds keep working; when they are sent they are enforced.
 */

export const MAX_FIX_AGE_MS = 2 * 60_000;
export const MAX_FUTURE_MS = 60_000;
export const MAX_ACCURACY_M = 150;

export const fixExtras = {
  accuracy: z.number().min(0).max(100_000).optional(),
  at: z.number().int().positive().optional(),
};

export function assertUsableFix(fix: { lat: number; lng: number; accuracy?: number; at?: number }, now = Date.now()): void {
  if (fix.lat === 0 && fix.lng === 0) throw new ApiError("VALIDATION_FAILED", "That is not a real position.");
  if (fix.accuracy !== undefined && fix.accuracy > MAX_ACCURACY_M) throw new ApiError("VALIDATION_FAILED", "The position is too imprecise to use.");
  if (fix.at !== undefined) {
    if (now - fix.at > MAX_FIX_AGE_MS) throw new ApiError("VALIDATION_FAILED", "That position is too old.");
    if (fix.at - now > MAX_FUTURE_MS) throw new ApiError("VALIDATION_FAILED", "The phone's clock is wrong.");
  }
}
