import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyArrivalToken } from "@/lib/arrival-token";
import { readArrival } from "@/lib/arrival-store";
import ArrivalClient from "./ArrivalClient";

export const dynamic = "force-dynamic";

/**
 * The page a passenger opens after landing.
 *
 * Never indexed and never linked from the site — it is reached only from the
 * link in the traveller's own email, and it shows one real person's movements.
 */
export const metadata: Metadata = {
  title:  { absolute: "Your arrival — Elite BCN" },
  robots: { index: false, follow: false, nocache: true },
};

const LINK_VALID_HOURS_AFTER_PICKUP = 24;

export default async function ArrivalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bookingId = verifyArrivalToken(token);
  if (!bookingId) notFound();

  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: {
      id: true, confirmationCode: true, guestName: true, flightNumber: true,
      pickupAddress: true, pickupDatetime: true,
      driver: { select: { user: { select: { name: true } } } },
    },
  });
  if (!booking) notFound();

  const cutoff = booking.pickupDatetime.getTime() + LINK_VALID_HOURS_AFTER_PICKUP * 3_600_000;
  if (Date.now() > cutoff) notFound();

  const events = await readArrival(booking.id);

  // Rendered on the server so the timeline is on screen in one paint. A
  // passenger opens this on airport wifi with a phone in one hand and a case in
  // the other; a spinner followed by a fetch is the wrong first impression.
  return (
    <ArrivalClient
      token={token}
      initialEvents={events}
      booking={{
        confirmationCode: booking.confirmationCode,
        firstName:        booking.guestName?.split(" ")[0] ?? null,
        flightNumber:     booking.flightNumber,
        pickupAddress:    booking.pickupAddress,
        driverName:       booking.driver?.user?.name ?? null,
      }}
    />
  );
}
