import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
 * Authorised by possession of the booking's confirmation code, which is a cuid
 * — long and unguessable — and which the customer already has in their
 * confirmation email. That avoids issuing a second secret to manage, and works
 * for guest bookings that have no account to log into.
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
          user:     { select: { name: true, phone: true } },
          vehicles: { take: 1, select: { make: true, model: true, licensePlate: true } },
        },
      },
    },
  });

  if (!booking || booking.isDeleted) notFound();

  const v = booking.driver?.vehicles[0];

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
    driverName:     booking.driver?.user.name ?? null,
    driverPhone:    booking.driver?.user.phone ?? booking.driver?.whatsappNumber ?? null,
    vehicle:        v ? `${v.make} ${v.model}`.trim() : null,
    plate:          v?.licensePlate ?? null,
  };

  return (
    <main className="min-h-screen bg-[#050505]">
      <PublicTrackClient booking={data} />
    </main>
  );
}
