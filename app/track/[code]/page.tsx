import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signTrackingToken } from "@/lib/tracking-access";
import PublicTrackClient, { type TrackBooking } from "@/components/tracking/PublicTrackClient";

export const dynamic = "force-dynamic";

// A tracking link is personal and transient. Keeping it out of the index and
// out of referrer headers matters more here than any SEO value it could carry.
export const metadata: Metadata = {
  title: { absolute: "Track your transfer | Elite BCN" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Public journey tracking.
 *
 * The page opens with the booking's confirmation code (the link in the customer's
 * confirmation email, which works for guest bookings that have no account). The code
 * only opens THIS page: the page then holds a signed, expiring tracking token and
 * uses that, not the code, to ask for positions (see lib/tracking-access.ts). The
 * driver's contact details are shown only while the ride is assigned or under way.
 */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const booking = await prisma.booking.findUnique({
    where: { confirmationCode: code },
    select: {
      id: true, confirmationCode: true, status: true, isDeleted: true,
      pickupAddress: true, dropoffAddress: true, pickupDatetime: true,
      pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
      driver: {
        select: {
          whatsappNumber: true,
          user:     { select: { name: true, phone: true, email: true } },
          vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
        },
      },
    },
  });

  if (!booking || booking.isDeleted) notFound();

  const v = booking.driver?.vehicles[0];
  const live = booking.status === "DRIVER_ASSIGNED" || booking.status === "IN_PROGRESS" || booking.status === "CONFIRMED";

  const data: TrackBooking = {
    id:             booking.id,
    code:           booking.confirmationCode,
    status:         booking.status,
    pickupAddress:  booking.pickupAddress,
    dropoffAddress: booking.dropoffAddress,
    pickupDatetime: booking.pickupDatetime.toISOString(),
    pickupLat:      booking.pickupLat,
    pickupLng:      booking.pickupLng,
    dropoffLat:     booking.dropoffLat,
    dropoffLng:     booking.dropoffLng,
    driverName:     live ? booking.driver?.user.name ?? null : null,
    driverPhone:    live ? booking.driver?.user.phone ?? booking.driver?.whatsappNumber ?? null : null,
    driverEmail:    live ? booking.driver?.user.email ?? null : null,
    vehicle:        live && v ? `${v.make} ${v.model}`.trim() : null,
    plate:          live ? v?.licensePlate ?? null : null,
    trackToken:     signTrackingToken(booking.id, booking.pickupDatetime),
  };

  return (
    <main className="min-h-screen bg-[#050505]">
      <PublicTrackClient booking={data} />
    </main>
  );
}
