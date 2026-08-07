import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DispatchBoard, { type DispatchJob, type DispatchDriver } from "@/components/admin/DispatchBoard";

export const dynamic = "force-dynamic";

/**
 * Today's operations at a glance.
 *
 * The admin bookings page is a searchable ledger of everything ever booked.
 * This answers a different question — what needs a driver in the next 24 hours,
 * and who is free to take it — so it is deliberately narrow: no history, no
 * search, only the jobs and drivers that matter right now.
 */
export default async function DispatchPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") redirect("/auth/login");

  const now  = new Date();
  const from = new Date(now.getTime() - 4 * 3600_000);    // include ones just started
  const to   = new Date(now.getTime() + 36 * 3600_000);

  const [bookings, drivers] = await Promise.all([
    prisma.booking.findMany({
      where: {
        isDeleted: false,
        pickupDatetime: { gte: from, lte: to },
        status: { in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
      },
      orderBy: { pickupDatetime: "asc" },
      select: {
        id: true, confirmationCode: true, status: true, paymentStatus: true,
        pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
        passengers: true, luggage: true, vehicleClass: true, flightNumber: true,
        totalAmount: true, guestName: true, guestPhone: true, driverId: true,
        driver: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.driver.findMany({
      where:  { status: { in: ["APPROVED", "ONLINE", "OFFLINE", "ON_RIDE"] } },
      select: {
        id: true, status: true, rating: true,
        currentLat: true, currentLng: true, lastLocationAt: true,
        user: { select: { name: true, phone: true } },
        vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
        _count: {
          select: {
            bookings: {
              where: {
                isDeleted: false,
                pickupDatetime: { gte: from, lte: to },
                status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] },
              },
            },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const jobs: DispatchJob[] = bookings.map((b) => ({
    id:             b.id,
    code:           b.confirmationCode.slice(0, 8).toUpperCase(),
    status:         b.status,
    paymentStatus:  b.paymentStatus,
    pickupAddress:  b.pickupAddress,
    dropoffAddress: b.dropoffAddress,
    pickupDatetime: b.pickupDatetime.toISOString(),
    passengers:     b.passengers,
    luggage:        b.luggage,
    vehicleClass:   b.vehicleClass,
    flightNumber:   b.flightNumber,
    totalAmount:    b.totalAmount,
    guestName:      b.guestName,
    guestPhone:     b.guestPhone,
    driverId:       b.driverId,
    driverName:     b.driver?.user.name ?? null,
  }));

  const fleet: DispatchDriver[] = drivers.map((d) => ({
    id:          d.id,
    name:        d.user.name ?? "Driver",
    phone:       d.user.phone,
    status:      d.status,
    rating:      d.rating,
    vehicle:     d.vehicles[0] ? `${d.vehicles[0].make} ${d.vehicles[0].model}`.trim() : null,
    plate:       d.vehicles[0]?.licensePlate ?? null,
    jobsToday:   d._count.bookings,
    lastSeenAt:  d.lastLocationAt?.toISOString() ?? null,
    hasLocation: d.currentLat != null && d.currentLng != null,
  }));

  return <DispatchBoard jobs={jobs} drivers={fleet} />;
}
