/**
 * Where a driver's mail goes, which is not always where they sign in.
 *
 * A driver's email address was doing two jobs at once: it was the unique key
 * they authenticate with, and it was the address every job sheet, temporary
 * password and flight alert was sent to. That is fine for an office driver
 * with their own inbox, and wrong for a fleet company, whose drivers often
 * have no work email at all and whose office wants all of it in one place it
 * controls. Trying to put the company address on a second driver was refused
 * with "that email already has an account", because it is the login.
 *
 * So the two jobs are separated. The login still identifies one driver and is
 * still unique. `notifyEmail` is where the post lands, and any number of
 * drivers may share one. Null means the login address, which is what every
 * office driver has and what a fleet driver with their own email keeps.
 */

/**
 * The domain generated sign-in addresses sit on.
 *
 * Deliberately not a real mailbox and deliberately a subdomain we own: a
 * generated login must never collide with somebody's actual address, and
 * nothing may ever be delivered to it, because nobody reads it.
 */
export const DRIVER_LOGIN_DOMAIN = "drivers.elitebcn.info";

export interface DriverMailTarget {
  notifyEmail?: string | null;
  user: { email: string };
}

/** The address to write to for this driver. */
export function driverMailTo(d: DriverMailTarget): string {
  const notify = d.notifyEmail?.trim();
  return notify && notify.length > 0 ? notify : d.user.email;
}

/**
 * True when this address only exists so somebody can sign in.
 *
 * A generated login carries the company as a subdomain, so the host is
 * `vito-transfers.drivers.elitebcn.info` and not the bare domain. Matching
 * only the bare one would have let the "your sign-in address changed" notice
 * go to an address nobody can open.
 */
export function isGeneratedLogin(email: string | null | undefined): boolean {
  const host = email?.trim().toLowerCase().split("@")[1];
  return !!host && (host === DRIVER_LOGIN_DOMAIN || host.endsWith(`.${DRIVER_LOGIN_DOMAIN}`));
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")   // José -> Jose
   .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);

/**
 * A sign-in address for a driver who has no email of their own.
 *
 * Readable rather than random, because somebody in the office has to read it
 * down a phone to a driver standing next to a car. `taken` is consulted so a
 * company with two drivers called Marc gets marc-2 rather than a crash on the
 * unique index.
 */
export function generateDriverLogin(name: string, company: string, taken: (email: string) => boolean): string {
  const person = slug(name) || "driver";
  const firm   = slug(company) || "fleet";
  const at     = (local: string) => `${local}@${firm}.${DRIVER_LOGIN_DOMAIN}`;
  if (!taken(at(person))) return at(person);
  for (let n = 2; n < 100; n++) {
    if (!taken(at(`${person}-${n}`))) return at(`${person}-${n}`);
  }
  // A hundred drivers of the same name in one company is not a real case, but
  // failing to add a driver would be, so fall back to something always free.
  return at(`${person}-${Date.now().toString(36)}`);
}
