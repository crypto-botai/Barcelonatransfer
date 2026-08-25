import destinations from "@/data/destinations.json";
import { ROUTES } from "@/lib/pricing";
import { routePageHref } from "@/lib/destination-pricing";

export interface HubChild {
  href: string;
  label: string;
}

/**
 * The pages a hub should link down to.
 *
 * The regional and service hubs named their destinations in prose and linked to
 * none of them: /transfers/costa-brava had 21 in-content inbound links and two
 * outbound, /pricing had one, /fleet had two. Authority arrived at a hub and
 * stopped there, while the route pages below sat on one or two inbound links.
 *
 * Lists are derived rather than typed out, so a repriced or renamed route
 * cannot leave a hub pointing at a page that no longer matches. Routes whose
 * destination has no page resolve to null and are simply not linked — the coast
 * hubs cover more places than the site has pages for.
 */
function fromRouteCategory(category: string): HubChild[] {
  const seen = new Set<string>();
  const out: HubChild[] = [];
  for (const r of ROUTES) {
    if (r.category !== category) continue;
    const href = routePageHref(r.from, r.to);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    // The route label reads "El Prat Airport ⇄ Sitges"; the destination end is
    // the half a reader is choosing between.
    const label = r.label.includes("⇄") ? r.label.split("⇄").pop()!.trim() : r.label;
    out.push({ href, label });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function fromDestinationType(type: string): HubChild[] {
  return (destinations as Array<{ slug: string; name: string; type: string }>)
    .filter((d) => d.type === type)
    .map((d) => ({ href: `/transfers/${d.slug}`, label: d.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Costa Brava destinations that have a page. Fewer than the coast has towns. */
export function costaBravaChildren(): HubChild[] {
  return fromRouteCategory("costa-brava");
}

/** Costa Dorada destinations that have a page. */
export function costaDoradaChildren(): HubChild[] {
  return fromRouteCategory("costa-dorada");
}

/** The cruise lines with a dedicated page. */
export function cruiseLineChildren(): HubChild[] {
  return fromDestinationType("cruise");
}

/** Every Barcelona hotel with a dedicated pickup page. */
export function hotelChildren(): HubChild[] {
  return fromDestinationType("hotel");
}
