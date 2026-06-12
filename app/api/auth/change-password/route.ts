import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string };
  const body = await req.json().catch(() => ({}));
  const { newPassword, currentPassword } = body as { newPassword?: string; currentPassword?: string };

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 422 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If mustChangePassword is false, verify existing password first
  if (!dbUser.mustChangePassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password required" }, { status: 422 });
    }
    if (!dbUser.passwordHash) {
      return NextResponse.json({ error: "No password set on this account" }, { status: 422 });
    }
    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash: hash, mustChangePassword: false },
  });

  return NextResponse.json({ success: true });
}
