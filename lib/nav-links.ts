/**
 * Turn-by-turn links for the chauffeur's phone.
 *
 * Coordinates are preferred when the booking has them (an airport terminal
 * or a hotel picked from the zone list); a typed address falls back to a
 * text search. Both apps open in navigation mode straight away.
 */
export type NavApp = "google" | "waze";

export const NAV_PREF_KEY = "elitebcn-driver-nav-app";

export function navUrl(app: NavApp, address: string, lat?: number | null, lng?: number | null): string {
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
  if (app === "waze") {
    return hasCoords
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  }
  const dest = hasCoords ? `${lat},${lng}` : encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving&dir_action=navigate`;
}

export function readNavPref(): NavApp {
  try { return (localStorage.getItem(NAV_PREF_KEY) as NavApp) === "waze" ? "waze" : "google"; } catch { return "google"; }
}

export function saveNavPref(app: NavApp) {
  try { localStorage.setItem(NAV_PREF_KEY, app); } catch { /* private mode */ }
}

/** Free waiting the fare includes before the clock counts against the passenger. */
export function freeWaitMinutes(airportPickup: boolean): number {
  return airportPickup ? 60 : 15;
}
