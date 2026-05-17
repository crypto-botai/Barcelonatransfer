import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import { Calendar, MapPin, Clock, Plus } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const user = session.user as { id: string; name?: string; email: string };

  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#050505] pt-20">
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl text-white">My Bookings</h1>
              <p className="text-dark-400 mt-1">Welcome back, {user.name?.split(" ")[0] ?? "there"}</p>
            </div>
            <Link href="/book" className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
              <Plus size={16} /> New Booking
            </Link>
          </div>

          {bookings.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Calendar size={40} className="text-dark-500 mx-auto mb-4" />
              <h2 className="font-display text-xl text-white mb-2">No Bookings Yet</h2>
              <p className="text-dark-400 mb-6">Book your first luxury transfer to get started.</p>
              <Link href="/book" className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold">
                Book a Transfer
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="glass-card gold-hover-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`status-badge ${STATUS_COLORS[b.status as BookingStatus]}`}>
                          {STATUS_LABELS[b.status as BookingStatus]}
                        </span>
                        <span className="text-dark-500 text-xs font-mono">{b.confirmationCode}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-dark-200 mb-1">
                        <MapPin size={13} className="text-gold-500 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{b.pickupAddress}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-dark-200 mb-3">
                        <MapPin size={13} className="text-dark-500 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{b.dropoffAddress}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-dark-500">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {formatDate(b.pickupDatetime)}
                        </span>
                        <span>{b.vehicleClass.replace(/_/g, " ")}</span>
                        <span>{b.passengers} pax</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display text-xl text-gold-400">{formatCurrency(b.totalAmount)}</p>
                      <p className="text-dark-500 text-xs mt-1">{b.paymentStatus}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
