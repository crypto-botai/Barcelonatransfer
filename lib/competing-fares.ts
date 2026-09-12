/**
 * What the alternatives to a private transfer cost, checked against the bodies
 * that set them.
 *
 * The cost calculator compares a private transfer with a taxi, the Aerobús and
 * the metro. Those figures were typed into the component in 2025 and left: the
 * taxi flagfall, per-km rate and airport supplement were all a tariff year out
 * of date, the Aerobús was 70 cents under, and the metro line told people to
 * use a T-casual card at the airport, where TMB does not accept it. A visitor
 * who followed that advice would have been turned back at the barrier with
 * their luggage.
 *
 * Every figure here carries the source it was read from and the date it was
 * checked. A test fails when the date is more than a year old, because these
 * are set annually and a stale comparison is worse than none: it is our own
 * page telling a customer the wrong price for somebody else's service.
 */

/** ISO date the figures below were last verified against their sources. */
export const FARES_CHECKED_ON = "2026-09-10";

/**
 * Barcelona metropolitan taxi, urban tariff 2026.
 * Source: Institut Metropolità del Taxi, "Tarifes urbanes del taxi per al 2026".
 */
export const TAXI = {
  t1: { label: "T-1", when: "Weekdays 08:00 to 20:00", flagfall: 2.80, perKm: 1.35 },
  t2: { label: "T-2", when: "Weekdays 20:00 to 08:00, Saturdays and public holidays", flagfall: 2.80, perKm: 1.66 },
  /** Origin or destination at the airport, or at Moll Adossat. */
  airportSupplement: 4.60,
  /** Minimum for a radio or app booking. A street hail has no minimum below the meter. */
  minimumRadioOrApp: 8.00,
  /** Tarifa 4: a fixed fare between the airport and the cruise terminal at Moll Adossat. */
  airportToCruiseFixed: 46,
  waitingPerHour: 27.75,
  source: "https://taxi.amb.cat/ca/imet/actualitat/noticies/detall/-/noticiataxi/tarifes-urbanes-del-taxi-per-al-2026/29760500/956832",
  sourceLabel: "AMB taxi tariff 2026",
} as const;

/**
 * Aerobús, both terminals to Plaça de Catalunya.
 * Source: the operator's own fares page.
 */
export const AEROBUS = {
  single: 7.45,
  return: 12.85,
  minutes: 35,
  source: "https://aerobusbarcelona.es/tarifas/",
  sourceLabel: "Aerobús fares",
} as const;

/**
 * Metro L9 Sud from Aeroport T1 / T2.
 *
 * The airport stations take one product only, the Bitllet Aeroport. T-casual,
 * T-usual and the other integrated titles are not valid there. Source: TMB,
 * "2026 transport ticket fares".
 */
export const METRO = {
  airportTicket: 5.90,
  tCasualValidAtAirport: false,
  minutes: 40,
  source: "https://www.tmb.cat/en/barcelona-fares-metro-bus/transport-ticket-fares",
  sourceLabel: "TMB fares 2026",
} as const;

/**
 * Rodalies R2 Nord from Aeroport station, which is at Terminal 2 only.
 *
 * No euro figure is published here on purpose. The fare is a standard Rodalies
 * zone ticket priced from the station you board at, it changes with the
 * regional tariff, and no official page states it as a single number for the
 * airport. Printing one would be a guess with a currency sign on it. The
 * journey facts are stable and are what a traveller needs to decide.
 */
export const AIRPORT_TRAIN = {
  line: "R2 Nord",
  terminal: "T2 only; from T1 take the free shuttle bus to T2 first",
  minutesToSants: 25,
  everyMinutes: 30,
  source: "https://rodalies.gencat.cat/",
  sourceLabel: "Rodalies de Catalunya",
} as const;

/** Human-readable "checked" date for the page, without shipping a date library. */
export function faresCheckedLabel(): string {
  const [y, m, d] = FARES_CHECKED_ON.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${d} ${months[m - 1]} ${y}`;
}
