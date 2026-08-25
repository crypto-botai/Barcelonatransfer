import type { HubChild } from "@/lib/hub-children";

const BASE = "https://www.elitebcn.info";

/**
 * A hub's contents, stated rather than inferred.
 *
 * The site had exactly one ItemList on 110 pages — /fleet. Every other hub
 * introduced its spokes in prose and linked to them, and left Google to work
 * out the relationship from the anchor tags alone. That works, but it is an
 * inference: nothing on /transfers/costa-brava said "this page covers these six
 * destinations, in this order", so nothing distinguished a hub from a page that
 * happens to mention six towns.
 *
 * ItemList says it directly. The list is built from the same derived children
 * the visible links are built from, so the markup and the page cannot disagree —
 * a destination that loses its page disappears from both at once.
 *
 * Deliberately a plain ListItem with name and url rather than a nested Service
 * per entry: the fare, the area and the provider live on the destination page
 * itself, and restating them here would create a second, staler copy of data
 * that already has one authoritative home. That is the mistake this codebase
 * has made twice.
 */
export function hubItemList(opts: {
  name: string;
  description: string;
  /** Path of the hub itself, e.g. "/transfers/costa-brava". */
  url: string;
  children: HubChild[];
}) {
  const { name, description, url, children } = opts;
  if (children.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url: `${BASE}${url}`,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: children.length,
    itemListElement: children.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      url: `${BASE}${c.href}`,
    })),
  } as const;
}

/**
 * BreadcrumbList for a page that sits one level under the root.
 *
 * /book, /tools/transfer-cost-calculator and the three legal pages carried no
 * breadcrumb at all — thirteen pages had none, and eight of those are the
 * homepages, which correctly do not need one. These five are not homepages.
 */
export function simpleBreadcrumb(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      ...trail.map((t, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: t.name,
        item: `${BASE}${t.path}`,
      })),
    ],
  } as const;
}
