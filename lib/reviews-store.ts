import { unstable_cache, revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REVIEWS, GOOGLE_PROFILE, type Review } from "@/data/reviews";

/**
 * Reviews the owner can edit, without a deploy.
 *
 * ── Where they are kept ──
 *
 * One row in ActivityLog, holding the whole set as JSON in its `details`
 * column. That is not where content naturally belongs, and the reason is
 * practical: this project applies schema changes by hand with
 * `prisma db push` against the live database, and there is no checkout to run
 * it from. A feature that cannot ship until someone runs a migration does not
 * ship. ActivityLog already has a JSON column, and a row saying the reviews
 * were edited is a fair audit entry in its own right.
 *
 * Swapping this for a real Review table later means rewriting this file and
 * nothing else — every caller goes through readReviews().
 *
 * ── Until the owner saves something ──
 *
 * data/reviews.ts is the fallback, so the site shows the sixteen transcribed
 * reviews exactly as it does today. The first save takes over; deleting the
 * row falls back again.
 */

const ENTITY = "ReviewsConfig";
const ENTITY_ID = "google";
const ACTION = "REVIEWS_UPDATED";
const TAG = "reviews";

export interface ReviewsProfile {
  /** The Google Business Profile's exact name — used in structured data. */
  name: string;
  /** google.com/maps?cid=… — the profile these came from. */
  cid: string;
  /** Average shown on the profile. */
  rating: number;
  /** Total reviews on the profile, which is not the same as the number shown here. */
  count: number;
}

export interface ReviewsPayload {
  profile: ReviewsProfile;
  reviews: Review[];
  /** Null while the site is still serving data/reviews.ts. */
  updatedAt: string | null;
  updatedBy: string | null;
}

const FALLBACK: ReviewsPayload = {
  profile: { ...GOOGLE_PROFILE },
  reviews: REVIEWS as Review[],
  updatedAt: null,
  updatedBy: null,
};

function clean(raw: unknown): ReviewsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const p = o.profile as Record<string, unknown> | undefined;
  const list = o.reviews;
  if (!p || !Array.isArray(list)) return null;

  const reviews: Review[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const author = typeof r.author === "string" ? r.author.trim() : "";
    if (!author) continue;
    const rating = Number(r.rating);
    reviews.push({
      author,
      rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 5,
      when: typeof r.when === "string" ? r.when : "",
      // An empty string is not the same as no text: a rating with no words is a
      // real thing a customer leaves, and the card renders that case.
      text: typeof r.text === "string" && r.text.trim() ? r.text : undefined,
      verified: r.verified === true,
    });
  }

  const rating = Number(p.rating);
  const count = Number(p.count);

  return {
    profile: {
      name: typeof p.name === "string" && p.name.trim() ? p.name : GOOGLE_PROFILE.name,
      cid: typeof p.cid === "string" ? p.cid : GOOGLE_PROFILE.cid,
      rating: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : GOOGLE_PROFILE.rating,
      count: Number.isFinite(count) && count >= 0 ? Math.round(count) : GOOGLE_PROFILE.count,
    },
    reviews,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
    updatedBy: typeof o.updatedBy === "string" ? o.updatedBy : null,
  };
}

async function load(): Promise<ReviewsPayload> {
  try {
    const row = await prisma.activityLog.findFirst({
      where: { entity: ENTITY, entityId: ENTITY_ID },
      orderBy: { createdAt: "desc" },
      select: { details: true, createdAt: true, adminName: true },
    });
    if (!row?.details) return FALLBACK;

    const parsed = clean(row.details);
    // A stored set with no usable reviews would blank the section. Falling back
    // shows the transcribed ones instead, which is the safer wrong answer.
    if (!parsed || parsed.reviews.length === 0) return FALLBACK;

    return {
      ...parsed,
      updatedAt: row.createdAt.toISOString(),
      updatedBy: row.adminName ?? parsed.updatedBy,
    };
  } catch (err) {
    console.error("[reviews] database read failed — serving data/reviews.ts:", err);
    return FALLBACK;
  }
}

/**
 * The reviews to show. Cached until a save flushes the tag, so the homepage
 * does not query on every request for a set that changes a few times a year.
 */
export const readReviews = unstable_cache(load, ["reviews-v1"], {
  tags: [TAG],
  revalidate: 3600,
});

/** Reads past the cache. For the editor, which must see its own last save. */
export async function readReviewsFresh(): Promise<ReviewsPayload> {
  return load();
}

export async function writeReviews(
  payload: { profile: ReviewsProfile; reviews: Review[] },
  adminName: string,
): Promise<ReviewsPayload> {
  const cleaned = clean({ ...payload });
  if (!cleaned) throw new Error("Reviews payload was not in the expected shape");

  // Replaced rather than appended: this row is the current set, not a log of
  // edits, and leaving old copies behind would make findFirst a lottery.
  await prisma.activityLog.deleteMany({ where: { entity: ENTITY, entityId: ENTITY_ID } });

  await prisma.activityLog.create({
    data: {
      action: ACTION,
      entity: ENTITY,
      entityId: ENTITY_ID,
      adminName,
      details: {
        profile: cleaned.profile,
        reviews: cleaned.reviews,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  revalidateTag(TAG, {});
  return { ...cleaned, updatedAt: new Date().toISOString(), updatedBy: adminName };
}

/** Removes the stored set, returning the site to data/reviews.ts. */
export async function resetReviews(): Promise<void> {
  await prisma.activityLog.deleteMany({ where: { entity: ENTITY, entityId: ENTITY_ID } });
  revalidateTag(TAG, {});
}
