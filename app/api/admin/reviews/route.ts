import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { readReviewsFresh, writeReviews, resetReviews } from "@/lib/reviews-store";

export const dynamic = "force-dynamic";

/**
 * The review editor's endpoint.
 *
 * The whole set is sent on every save rather than one review at a time. It is
 * sixteen short entries edited in one sitting, and a single write means the
 * page can never be caught showing half of an edit.
 */

const reviewSchema = z.object({
  author: z.string().trim().min(1, "Every review needs the reviewer's name").max(120),
  rating: z.number().int().min(1).max(5),
  when: z.string().trim().max(60).default(""),
  // Optional because a rating with no words is a real review and the card
  // renders it. Empty string and absent are treated the same downstream.
  text: z.string().trim().max(4000).optional(),
  verified: z.boolean().default(false),
});

const payloadSchema = z.object({
  profile: z.object({
    name: z.string().trim().min(1).max(160),
    cid: z.string().trim().max(64).default(""),
    rating: z.number().min(0).max(5),
    count: z.number().int().min(0).max(100000),
  }),
  reviews: z.array(reviewSchema).max(200),
});

async function admin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; name?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Fresh, not cached: the editor has to show the save it just made.
  return NextResponse.json(await readReviewsFresh());
}

export async function PUT(req: NextRequest) {
  const user = await admin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  }

  // Refusing an empty list is deliberate. Saving nothing would blank the
  // section on the homepage, and that is far more likely to be a mistake than
  // an intention — "remove them all" is the reset below.
  if (parsed.data.reviews.length === 0) {
    return NextResponse.json(
      { error: "Save at least one review, or use Reset to go back to the built-in set." },
      { status: 422 },
    );
  }

  const saved = await writeReviews(parsed.data, user.name ?? user.email ?? "Admin");
  return NextResponse.json({ ok: true, ...saved });
}

export async function DELETE() {
  if (!(await admin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await resetReviews();
  return NextResponse.json({ ok: true, reset: true });
}
