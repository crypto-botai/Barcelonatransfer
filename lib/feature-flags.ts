/**
 * Switches for work that is finished in the code but not yet safe to show.
 *
 * A flag here is a statement that something is built and reviewed, and is held
 * back by a dependency outside the repository — not a place to park an unfinished
 * idea.
 */

/**
 * Round trips: book the journey out and the journey home together.
 *
 * ON since 9 Sep 2026. `Booking.returnOfId`, its unique index and its foreign
 * key were applied to the production database that day and verified by reading
 * information_schema back.
 *
 * Kept as a flag rather than deleted: it is the switch that turns the option
 * off again without a revert, if a round trip ever misbehaves in a way that is
 * quicker to stop than to diagnose.
 */
export const RETURN_TRIPS_ENABLED = true;
