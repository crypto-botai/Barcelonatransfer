import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import { Car, MapPin, Clock, CheckCircle2, Calendar } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";
import Link from "next/link";

export default async function DriverPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || user?.role !== "DRIVER") redirect("/auth/login");

  const driver = await prisma.driver.findUnique({
    where: { userId: user.id! },
    include: {
      bookings: {
        orderBy: { pickupDatetime: "asc" },
        take: 20,
        where: { status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS", "CONFIRMED"] } },
      },
    },
  });

  if (!driver) return redirect("/auth/login");

  if (driver.status === "PENDING_APPROVAL") {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 pt-20">
          <div className="glass-card rounded-2xl p-10 text-center max-w-md">
            <Clock size={40} className="text-yellow-400 mx-auto mb-4" />
            <h2 className="font-display text-2xl text-white mb-2">Pending Approval</h2>
            <p className="text-dark-400">Your driver application is under review. You will be notified once approved.</p>
          </div>
        </main>
      </>
    );
  }

  const completedRides = await prisma.booking.count({
    where: { driverId: driver.id, status: "COMPLETED" },
  });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#050505] pt-20">
        <div className="container mx-auto px-4 py-10 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl text-white">Driver Dashboard</h1>
              <p className="text-dark-400 mt-1">
                Status:{" "}
                <span className={driver.status === "ONLINE" ? "text-green-400" : "text-yellow-400"}>
                  {driver.status}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/driver/profile" className="btn-outline-gold px-4 py-2.5 rounded-xl text-sm">
                My Profile
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="font-display text-3xl text-gold-400">{driver.totalRides}</p>
              <p className="text-dark-400 text-xs mt-1">Total Rides</p>
            </div>
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="font-display text-3xl text-gold-400">{driver.rating > 0 ? `${driver.rating.toFixed(1)}★` : "—"}</p>
              <p className="text-dark-400 text-xs mt-1">Rating</p>
            </div>
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="font-display text-3xl text-gold-400">{driver.bookings.length}</p>
              <p className="text-dark-400 text-xs mt-1">Upcoming</p>
            </div>
          </div>

          {/* Assigned rides */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.06]">
              <h2 className="text-white font-medium">Assigned Rides</h2>
            </div>
            {driver.bookings.length === 0 ? (
              <div className="py-12 text-center">
                <Car size={32} className="text-dark-500 mx-auto mb-3" />
                <p className="text-dark-400">No rides assigned yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {driver.bookings.map((b) => (
                  <div key={b.id} className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`status-badge ${STATUS_COLORS[b.status as BookingStatus]}`}>
                            {STATUS_LABELS[b.status as BookingStatus]}
                          </span>
                          <span className="text-dark-500 text-xs font-mono">{b.confirmationCode}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-dark-200 mb-1">
                          <MapPin size={13} className="text-gold-500 mt-0.5 flex-shrink-0" />
                          {b.pickupAddress}
                        </div>
                        <div className="flex items-start gap-2 text-sm text-dark-400">
                          <MapPin size={13} className="text-dark-500 mt-0.5 flex-shrink-0" />
                          {b.dropoffAddress}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-dark-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={11} /> {formatDate(b.pickupDatetime)}
                          </span>
                          <span>{b.passengers} pax</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl text-gold-400">{formatCurrency(b.totalAmount)}</p>
                        <p className="text-dark-500 text-xs">{b.vehicleClass.replace(/_/g, " ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
