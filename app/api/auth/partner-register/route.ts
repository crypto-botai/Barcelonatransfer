import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendAdminAlertEmail } from "@/lib/resend";

export const dynamic = "force-dynamic";

/**
 * A fleet company applying for an account itself.
 *
 * Creates the login and the company record inactive. Nothing can be
 * dispatched to it until the office activates it from Admin → Fleet
 * Partners; the office is emailed the application. Compare the admin route,
 * which creates an active company with a temporary password.
 */
const schema = z.object({
  name:        z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
  email:       z.string().email(),
  phone:       z.string().min(6).max(30),
  password:    z.string().min(8).max(200),
  taxId:       z.string().max(40).optional(),
  address:     z.string().max(200).optional(),
  fleetSize:   z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;
  const email = d.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "That email already has an account. Sign in, or delete that account first from its settings." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 12);
  const partner = await prisma.fleetPartner.create({
    data: {
      name: d.name.trim(),
      contactName: d.contactName.trim(),
      email,
      phone: d.phone.trim(),
      taxId: d.taxId?.trim() || null,
      address: d.address?.trim() || null,
      active: false,
      notes: d.fleetSize ? `Applied online. Fleet size: ${d.fleetSize.trim()}` : "Applied online.",
      user: { create: { name: d.contactName.trim(), email, phone: d.phone.trim(), passwordHash, role: "PARTNER" } },
    },
  });

  sendAdminAlertEmail(
    `Fleet company application — ${partner.name}`,
    `${partner.name} (${partner.contactName}, ${partner.phone}, ${email}) has applied for a fleet partner account.\n` +
    (d.fleetSize ? `Fleet size: ${d.fleetSize}\n` : "") +
    `\nActivate or decline at ${process.env.NEXTAUTH_URL ?? "https://www.elitebcn.info"}/admin/partners/${partner.id}`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, id: partner.id }, { status: 201 });
}
