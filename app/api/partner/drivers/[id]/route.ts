import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePartner } from "@/lib/partner";
import { sendDriverEmailChanged } from "@/lib/resend";
import { isGeneratedLogin } from "@/lib/driver-email";

const schema = z.object({
  name:          z.string().min(2).optional(),
  /**
   * The driver signs in with this, so changing it changes their login. The
   * handler refuses an address already in use and writes to the driver at
   * the new one, because a company that mistypes it would otherwise lock
   * their driver out with nothing on screen to say so.
   */
  email:         z.string().email().optional(),
  phone:         z.string().min(6).optional(),
  licenseNumber: z.string().nullable().optional(),
  /** APPROVED puts them back on the roster; SUSPENDED takes them off. */
  status:        z.enum(["APPROVED", "SUSPENDED"]).optional(),
  vehicleMake:   z.string().min(1).optional(),
  vehicleModel:  z.string().min(1).optional(),
  vehiclePlate:  z.string().min(2).optional(),
  vehicleClass:  z.enum(["ECONOMY", "BUSINESS", "LUXURY", "ELECTRIC_VIP", "MINIVAN", "LUXURY_MINIVAN", "MINIBUS"]).optional(),
  vehicleColor:  z.string().optional(),
  /**
   * Send this driver's mail to the company instead of to their own address.
   *
   * Separate from the login on purpose: any number of drivers may share one
   * inbox, but each still signs in as themselves, so the company can still
   * dispatch to one of them and see where that one is.
   */
  mailToCompany: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await requirePartner();
  if (!p) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 422 });
  const d = parsed.data;

  const driver = await prisma.driver.findFirst({
    where: { id, partnerId: p.id },
    include: { vehicles: { take: 1 }, user: { select: { email: true, name: true } } },
  });
  if (!driver) return NextResponse.json({ error: "Not one of your drivers" }, { status: 404 });

  // A new sign-in address has to be free, and the driver has to be told.
  const email = d.email?.trim().toLowerCase();
  const emailChanged = !!email && email !== driver.user.email.toLowerCase();
  if (emailChanged) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "That email already has an account" }, { status: 409 });
  }

  const mailToCompany = d.mailToCompany;

  await prisma.$transaction([
    prisma.driver.update({
      where: { id },
      data: {
        ...(d.status ? { status: d.status } : {}),
        ...(d.licenseNumber !== undefined ? { licenseNumber: d.licenseNumber } : {}),
        ...(d.phone ? { whatsappNumber: d.phone } : {}),
        ...(mailToCompany === undefined ? {} : { notifyEmail: mailToCompany ? p.email.trim().toLowerCase() : null }),
      },
    }),
    prisma.user.update({
      where: { id: driver.userId },
      data: {
        ...(d.name ? { name: d.name } : {}),
        ...(d.phone ? { phone: d.phone } : {}),
        ...(emailChanged ? { email } : {}),
      },
    }),
    ...(driver.vehicles[0] && (d.vehicleMake || d.vehicleModel || d.vehiclePlate || d.vehicleClass || d.vehicleColor)
      ? [prisma.vehicle.update({
          where: { id: driver.vehicles[0].id },
          data: {
            ...(d.vehicleMake ? { make: d.vehicleMake } : {}),
            ...(d.vehicleModel ? { model: d.vehicleModel } : {}),
            ...(d.vehiclePlate ? { licensePlate: d.vehiclePlate.toUpperCase() } : {}),
            ...(d.vehicleClass ? { class: d.vehicleClass as never } : {}),
            ...(d.vehicleColor ? { color: d.vehicleColor } : {}),
          },
        })]
      : []),
  ]);

  if (emailChanged) {
    // Sent to both: the new address is where they sign in from now on, and
    // the old one is the only place a driver who did not ask for this will
    // notice that it happened. A generated sign-in address is skipped, since
    // it is not a mailbox and nothing sent there is ever read.
    const who = d.name ?? driver.user.name ?? "there";
    await Promise.allSettled(
      [email!, driver.user.email]
        .filter((to) => !isGeneratedLogin(to))
        .map((to) => sendDriverEmailChanged({ to, name: who, newEmail: email!, company: p.name })),
    );
  }

  return NextResponse.json({ ok: true, emailChanged });
}
