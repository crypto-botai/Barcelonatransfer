import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import DriverDashboard from "@/components/driver/DriverDashboard";
import { Clock } from "lucide-react";

export default async function DriverPage() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!session || user?.role !== "DRIVER") redirect("/auth/login");

  const driver = await prisma.driver.findUnique({
    where:   { userId: user.id! },
    include: {
      user:  { select: { name: true, email: true, phone: true } },
      bookings: {
        orderBy: { pickupDatetime: "desc" },
        take:    50,
        select: {
          id: true, confirmationCode: true, status: true,
          pickupAddress: true, dropoffAddress: true, pickupLat: true, pickupLng: true,
          pickupDatetime: true, passengers: true, luggage: true,
          vehicleClass: true, totalAmount: true, driverAmount: true,
          guestName: true, guestPhone: true, flightNumber: true,
        },
      },
      withdrawals: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!driver) redirect("/auth/login");

  if (driver.status === "PENDING_APPROVAL") {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-20">
          <div className="glass-card rounded-2xl p-10 text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-5">
              <Clock size={28} className="text-yellow-400" />
            </div>
            <h2 className="font-display text-2xl text-white mb-3">Under Review</h2>
            <p className="text-dark-400 leading-relaxed mb-4">
              Welcome, <span className="text-white">{driver.user.name ?? "Driver"}</span>! Your application has been received and is being reviewed by our team.
            </p>
            <p className="text-dark-500 text-sm">You will be notified once your account is approved. Usually within 24–48 hours.</p>
            <div className="mt-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <p className="text-yellow-400/80 text-xs">
                To speed up approval, make sure you have uploaded your driving licence, vehicle permission, and insurance documents.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  const [completedCount, earningsResult] = await Promise.all([
    prisma.booking.count({ where: { driverId: driver.id, status: "COMPLETED" } }),
    prisma.booking.aggregate({
      where: { driverId: driver.id, status: "COMPLETED" },
      _sum: { driverAmount: true },
    }),
  ]);
  const totalEarnings = earningsResult._sum.driverAmount ?? 0;

  return (
    <>
      <Navbar />
      <DriverDashboard
        driver={{
          id:           driver.id,
          status:       driver.status,
          rating:       driver.rating,
          totalRides:   driver.totalRides,
          whatsappNumber: driver.whatsappNumber,
          user:         driver.user,
        }}
        bookings={driver.bookings as Parameters<typeof DriverDashboard>[0]["bookings"]}
        withdrawals={driver.withdrawals as Parameters<typeof DriverDashboard>[0]["withdrawals"]}
        completedCount={completedCount}
        totalEarnings={totalEarnings}
      />
    </>
  );
}
