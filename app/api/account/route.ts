import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Deleting your own account.
 *
 * Offered on every portal so someone can close a customer account and open
 * a company or driver one with the same email. The login, profile,
 * notifications, push subscriptions, saved details and, for a driver or a
 * company, their driver record, vehicles and withdrawals go with it. A
 * company's drivers are its own; their logins are removed too.
 *
 * Bookings are not deleted. They are the business's record of journeys
 * driven and money taken, and stay as guest bookings with no account
 * attached. Admin accounts cannot delete themselves here.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !u?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (u.role === "ADMIN") return NextResponse.json({ error: "An admin account cannot be deleted from here" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, fleetPartner: { select: { id: true } }, driver: { select: { id: true } } },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // A company takes its drivers with it: they were created by the company
    // and only ever drove its jobs. Their bookings stay, unassigned.
    if (user.fleetPartner) {
      const drivers = await tx.driver.findMany({ where: { partnerId: user.fleetPartner.id }, select: { id: true, userId: true } });
      const driverIds = drivers.map((d) => d.id);
      const driverUserIds = drivers.map((d) => d.userId);
      /**
       * A job whose driver has just gone needs a driver again.
       *
       * Clearing driverId without moving the status left the booking saying
       * DRIVER_ASSIGNED with nobody on it. The company's panel renders that
       * as "Dispatched", keeps it out of the Incoming tab, and the Dispatch
       * button only exists on Incoming - so the job could never be given to
       * anyone again from the panel. unassignPartner a few lines away in
       * lib/partner.ts already does this correctly.
       */
      await tx.booking.updateMany({
        where: { driverId: { in: driverIds }, status: "DRIVER_ASSIGNED" },
        data: { driverId: null, driverAssignedAt: null, status: "CONFIRMED" },
      });
      await tx.booking.updateMany({ where: { driverId: { in: driverIds } }, data: { driverId: null } });
      await tx.booking.updateMany({ where: { partnerId: user.fleetPartner.id }, data: { partnerId: null } });
      await tx.notification.deleteMany({ where: { userId: { in: driverUserIds } } });
      await tx.pushSubscription.deleteMany({ where: { userId: { in: driverUserIds } } });
      await tx.user.deleteMany({ where: { id: { in: driverUserIds } } });
    }
    if (user.driver) {
      // Same as above: the job goes back to needing a driver, not to limbo.
      await tx.booking.updateMany({
        where: { driverId: user.driver.id, status: "DRIVER_ASSIGNED" },
        data: { driverId: null, driverAssignedAt: null, status: "CONFIRMED" },
      });
      await tx.booking.updateMany({ where: { driverId: user.driver.id }, data: { driverId: null } });
    }
    // Rows that point at the user without a database relation.
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.pushSubscription.deleteMany({ where: { userId: user.id } });
    await tx.companyMember.deleteMany({ where: { userId: user.id } });
    // Bookings keep their journey and payment record; the account link goes.
    await tx.booking.updateMany({ where: { userId: user.id }, data: { userId: null } });
    // Everything else cascades from the user row: driver, vehicles,
    // withdrawals, profile, sessions, OAuth accounts, fleet partner.
    await tx.user.delete({ where: { id: user.id } });
  });

  return NextResponse.json({ ok: true });
}
