import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// One-time admin seed endpoint — disable after first use by removing the route or
// checking process.env.ADMIN_SEED_SECRET.
export async function POST(req: Request) {
  const secret = process.env.ADMIN_SEED_SECRET;
  if (secret) {
    const { key } = await req.json().catch(() => ({}));
    if (key !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const email = process.env.ADMIN_EMAIL ?? "vtcbcn2025@gmail.com";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "EliteBCN2025!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      return NextResponse.json({ message: "Existing user promoted to ADMIN", email });
    }
    return NextResponse.json({ message: "Admin already exists", email });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: "Admin",
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  return NextResponse.json({ message: "Admin created", id: user.id, email: user.email });
}
