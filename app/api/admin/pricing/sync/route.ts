import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { FIXED_ROUTES } from "@/lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Adds routes that exist in the code's price table but have no row in the
 * database yet.
 *
 * Booking quotes already fall back to the code table, so a missing row does not
 * break a sale — but the public pricing page and the admin editor both read the
 * database, so a new route is invisible in both until it is copied across.
 *
 * Deliberately additive. It never edits or deletes an existing row: the
 * database is where the owner's own price changes live, and a sync that
 * overwrote them would quietly undo hand-set prices the next time anyone
 * pressed it.
 */

interface Missing {
  slug: string;
  label: string;
  fromKey: string;
  toKey: string;
  category: string;
  prices: Record<string, number>;
}

async function findMissing(): Promise<Missing[]> {
  const existing = await prisma.route.findMany({ select: { slug: true, fromKey: true, toKey: true } });
  const bySlug = new Set(existing.map((r) => r.slug));
  // Also match on the zone pair: the same journey stored under a different slug
  // is the same route, and adding it twice would show the customer two prices.
  const byPair = new Set(existing.flatMap((r) => [`${r.fromKey}>${r.toKey}`, `${r.toKey}>${r.fromKey}`]));

  return FIXED_ROUTES.flatMap((r) => {
    const fromKey = ZONE_CODE_TO_KEY[r.from] ?? r.from.toLowerCase();
    const toKey   = ZONE_CODE_TO_KEY[r.to]   ?? r.to.toLowerCase();
    if (bySlug.has(r.slug) || byPair.has(`${fromKey}>${toKey}`)) return [];
    return [{
      slug:     r.slug,
      label:    `${r.fromLabel} ⇄ ${r.toLabel}`,
      fromKey,
      toKey,
      category: r.category === "airport-city" ? "airport" : r.category,
      prices:   r.prices as unknown as Record<string, number>,
    }];
  });
}

/** Preview — what a sync would add, changing nothing. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ missing: await findMissing() });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = await findMissing();
  if (missing.length === 0) {
    return NextResponse.json({ ok: true, added: 0, routes: [] });
  }

  const updatedBy = user.email ?? "admin";
  const maxOrder = (await prisma.route.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;

  for (const [i, m] of missing.entries()) {
    await prisma.route.create({
      data: {
        slug:      m.slug,
        fromKey:   m.fromKey,
        toKey:     m.toKey,
        label:     m.label,
        category:  m.category,
        sortOrder: maxOrder + i + 1,
        prices: {
          create: Object.entries(m.prices).map(([vehicleCode, price]) => ({
            vehicleCode, price, updatedBy,
          })),
        },
      },
    });
  }

  console.info(
    `[pricing-audit] ${updatedBy} added ${missing.length} route(s) at ${new Date().toISOString()}:`,
    missing.map((m) => m.slug).join(", "),
  );

  await prisma.activityLog.create({
    data: {
      action:   "SYNC_ROUTES",
      entity:   "Route",
      entityId: missing.map((m) => m.slug).join(","),
      details:  { added: missing.length, slugs: missing.map((m) => m.slug) },
    },
  }).catch(() => {});

  revalidateTag("pricing", {});

  return NextResponse.json({ ok: true, added: missing.length, routes: missing.map((m) => m.label) });
}
