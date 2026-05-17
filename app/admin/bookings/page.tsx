"use client";

import { useEffect, useState } from "react";
import { Search, Filter, CheckCircle2, XCircle, User, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";
import toast from "react-hot-toast";

type Booking = {
  id: string;
  confirmationCode: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupDatetime: string;
  vehicleClass: string;
  passengers: number;
  totalAmount: number;
  status: BookingStatus;
  paymentStatus: string;
  driverId: string | null;
  createdAt: string;
};

const ALL_STATUSES: BookingStatus[] = ["PENDING","CONFIRMED","DRIVER_ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<BookingStatus | "ALL">("ALL");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/bookings");
    if (res.ok) setBookings(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: BookingStatus) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Status updated"); load(); }
    else toast.error("Failed to update");
  };

  const filtered = bookings.filter((b) => {
    const matchSearch = !search || [b.confirmationCode, b.guestName, b.guestEmail, b.pickupAddress]
      .some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === "ALL" || b.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Bookings</h1>
          <p className="text-dark-400 mt-1">{bookings.length} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input type="text" placeholder="Search bookings…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="input-luxury pl-9 pr-4 py-2.5 rounded-xl text-sm w-64" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["ALL", ...ALL_STATUSES] as (BookingStatus | "ALL")[]).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === s ? "bg-gold-500 text-black" : "border border-white/10 text-dark-400 hover:text-white"
              }`}>
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-gold-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Code","Client","Route","Date","Vehicle","Amount","Status","Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="price-row border-b border-white/[0.04]">
                    <td className="py-3 px-4 text-xs font-mono text-dark-300">{b.confirmationCode}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-white">{b.guestName ?? "—"}</p>
                      <p className="text-xs text-dark-500">{b.guestEmail}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-dark-400 max-w-[140px]">
                      <p className="truncate">{b.pickupAddress}</p>
                      <p className="truncate text-dark-600">→ {b.dropoffAddress}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-dark-400 whitespace-nowrap">
                      {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="py-3 px-4 text-xs text-dark-400">{b.vehicleClass.replace(/_/g, " ")}</td>
                    <td className="py-3 px-4 text-sm text-gold-400 font-semibold">{formatCurrency(b.totalAmount)}</td>
                    <td className="py-3 px-4">
                      <span className={`status-badge ${STATUS_COLORS[b.status]}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {b.status === "PENDING" && (
                          <button onClick={() => updateStatus(b.id, "CONFIRMED")}
                            className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {b.status !== "CANCELLED" && b.status !== "COMPLETED" && (
                          <button onClick={() => updateStatus(b.id, "CANCELLED")}
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-dark-500">No bookings found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
