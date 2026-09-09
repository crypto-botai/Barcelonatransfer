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
 * OFF until `Booking.returnOfId` exists in the production database.
 *
 * Everything else is in place and tested — the form, the two-leg quote, the
 * paired bookings, the confirmation email naming both references. Only the
 * column is missing, and creating the return leg without it throws: the
 * customer would enter both addresses, pick both dates, reach the payment step
 * and be told to use WhatsApp. They would not be charged, but they would have
 * done all the work for nothing, which is worse than not offering the option.
 *
 * The migration is additive and nullable, so it can be applied to the live
 * database while this is still false and nothing will notice:
 *
 *   npx vercel env pull .env.vercel-live --environment=production
 *   npx prisma migrate diff \
 *     --from-schema-datasource prisma/schema.prisma \
 *     --to-schema-datamodel   prisma/schema.prisma --script    # inspect first
 *   npx prisma db push
 *
 * Then set this to true and deploy. That is the whole release.
 */
export const RETURN_TRIPS_ENABLED = false;
