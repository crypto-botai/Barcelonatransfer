import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const name  = typeof body.name  === "string" ? body.name.trim()  : undefined;
    const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;

    if (name !== undefined && name.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name  !== undefined && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: { id: true, name: true, email: true, phone: true, image: true },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[user/profile]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
