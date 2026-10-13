/**
 * The map style used by every MapLibre map on the website (admin live fleet). One place to change the provider.
 *
 * Default: OpenFreeMap "dark" style (free, no key, OpenStreetMap data in OpenMapTiles vector tiles; attribution required and
 * included by the style). Override with NEXT_PUBLIC_MAP_STYLE_URL to use another provider or a self-hosted style, for example a
 * paid MapTiler/Stadia style URL (their keys are public by design and restricted by domain in their dashboards).
 */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/dark";
