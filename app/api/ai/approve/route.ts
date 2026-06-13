/**
 * Approval queue API — admin-only.
 *
 * GET  /api/ai/approve          — list pending items (optionally filtered by type)
 * PATCH /api/ai/approve         — approve or reject an item by id
 *
 * Agents NEVER apply changes automatically. Every proposed change requires
 * admin approval via this endpoint before anything touches production data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string; email?: string } | undefined;
  if (!session || user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

// ─── GET — list pending approval items ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type") ?? undefined;
  const rawStatus = searchParams.get("status") ?? "PENDING";
  const validStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
  type ApprovalStatus = (typeof validStatuses)[number];
  const status: ApprovalStatus | "ALL" = (validStatuses as readonly string[]).includes(rawStatus)
    ? (rawStatus as ApprovalStatus)
    : rawStatus === "ALL" ? "ALL" : "PENDING";
  const take = Math.min(parseInt(searchParams.get("take") ?? "50", 10), 100);

  const items = await prisma.approvalItem.findMany({
    where: {
      ...(type                  ? { type }             : {}),
      ...(status !== "ALL"      ? { status }            : {}),
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({ items, count: items.length });
}

// ─── PATCH — approve or reject ────────────────────────────────────────────────

const patchSchema = z.object({
  id:         z.string().min(1),
  action:     z.enum(["approve", "reject"]),
  reviewNote: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request", details: body.error.flatten() }, { status: 400 });
  }

  const { id, action, reviewNote } = body.data;

  const existing = await prisma.approvalItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Item already reviewed" }, { status: 409 });
  }

  const updated = await prisma.approvalItem.update({
    where: { id },
    data: {
      status:     action === "approve" ? "APPROVED" : "REJECTED",
      reviewedBy: (auth as { email?: string }).email ?? "admin",
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });

  return NextResponse.json({ item: updated });
}
