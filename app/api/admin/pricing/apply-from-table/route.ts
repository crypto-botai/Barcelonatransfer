import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { FIXED_ROUTES } from "@/lib/fixed-prices";
import { ZONE_CODE_TO_KEY } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Copies one vehicle's prices from the code table into the database.
 *
 * Quotes read the database first and only fall back to the table in the code,
 * and every route has a database row. So a price changed in code and deployed
 * changes nothing a customer pays — it sits there looking applied. The existing
 * sync route does not close that gap either: it is deliberately additive and
 * only inserts routes the database has never seen.
 *
 * This is the missing half, kept narrow on purpose:
 *
 *   * One vehicle column at a time, named in the request. A "copy everything"
 *     button would silently flatten every price the owner has hand-set in this
 *     editor, which is the exact thing the additive sync was written to avoid.
 *   * It never lowers a live fare unless asked. The database is where a
 *     deliberate price sits; if it is above the table, that is a decision, not
 *     drift, and it is reported rather than overwritten.
 *   * GET previews and changes nothing. Nothing is written without a POST.
 */

const CODES = ["ECONOMY", "BUSINESS", "MINIVAN", "VCLASS", "MINIBUS"] as const;
type Code = (typeof CODES)[number];

const querySchema = z.object({
  vehicleCode: z.enum(CODES).default("MINIBUS"),
  allowDecrease: z.boolean().default(false),
});

interface Row {
  routeId: string;
  slug: string;
  label: string;
  db: number | null;
  code: number;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return user;
}

/** Table price for this vehicle, keyed both by slug and by zone pair. */
function codePrices(vehicleCode: Code) {
  const bySlug = new Map<string, number>();
  const byPair = new Map<string, number>();

  for (const r of FIXED_ROUTES) {
    const price = (r.prices as Record<string, number>)[vehicleCode];
    if (typeof price !== "number") continue;

    bySlug.set(r.slug, price);

    // Sorted, because one row serves the journey in both directions and the
    // database may store it the other way round from the code table.
    const from = ZONE_CODE_TO_KEY[r.from] ?? r.from.toLowerCase();
    const to = ZONE_CODE_TO_KEY[r.to] ?? r.to.toLowerCase();
    byPair.set([from, to].sort().join("|"), price);
  }
  return { bySlug, byPair };
}

async function diff(vehicleCode: Code, allowDecrease: boolean) {
  const { bySlug, byPair } = codePrices(vehicleCode);

  const routes = await prisma.route.findMany({
    include: { prices: true },
    orderBy: { sortOrder: "asc" },
  });

  const toApply: Row[] = [];
  const wouldLower: Row[] = [];
  const notInTable: string[] = [];

  for (const r of routes) {
    const pair = [r.fromKey, r.toKey].sort().join("|");
    const code = bySlug.get(r.slug) ?? byPair.get(pair);
    if (code === undefined) {
      notInTable.push(r.slug);
      continue;
    }

    const db = r.prices.find((p) => p.vehicleCode === vehicleCode)?.price ?? null;
    if (db === code) continue;

    const row: Row = { routeId: r.id, slug: r.slug, label: r.label ?? r.slug, db, code };
    if (db !== null && code < db && !allowDecrease) wouldLower.push(row);
    else toApply.push(row);
  }

  return { toApply, wouldLower, notInTable };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    vehicleCode: sp.get("vehicleCode") ?? undefined,
    allowDecrease: sp.get("allowDecrease") === "true",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  }

  const { vehicleCode, allowDecrease } = parsed.data;
  const { toApply, wouldLower, notInTable } = await diff(vehicleCode, allowDecrease);

  return NextResponse.json({
    vehicleCode,
    toApply: toApply.map(({ slug, label, db, code }) => ({ slug, label, db, code })),
    wouldLower: wouldLower.map(({ slug, label, db, code }) => ({ slug, label, db, code })),
    notInTable,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = querySchema.safeParse({
    vehicleCode: (body as { vehicleCode?: string }).vehicleCode ?? undefined,
    allowDecrease: (body as { allowDecrease?: boolean }).allowDecrease === true,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  }

  const { vehicleCode, allowDecrease } = parsed.data;
  const { toApply, wouldLower } = await diff(vehicleCode, allowDecrease);

  if (toApply.length === 0) {
    return NextResponse.json({ ok: true, applied: 0, skipped: wouldLower.length });
  }

  const updatedBy = user.email ?? "admin";
  const now = new Date();

  await Promise.all(
    toApply.map(({ routeId, code }) =>
      prisma.routePrice.upsert({
        where: { routeId_vehicleCode: { routeId, vehicleCode } },
        update: { price: code, updatedBy, updatedAt: now },
        create: { routeId, vehicleCode, price: code, updatedBy },
      }),
    ),
  );

  console.info(
    `[pricing-audit] ${updatedBy} applied ${vehicleCode} from the code table to ` +
    `${toApply.length} route(s) at ${now.toISOString()}:`,
    toApply.map(({ slug, db, code }) => `${slug} ${db}->${code}`),
  );

  // Quotes cache the database read for an hour; without this the site would
  // keep serving the old fare until the TTL happened to expire.
  revalidateTag("pricing", {});

  return NextResponse.json({ ok: true, applied: toApply.length, skipped: wouldLower.length });
}
