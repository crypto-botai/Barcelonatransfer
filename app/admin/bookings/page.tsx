"use client";

import { useEffect, useState } from "react";
import { Search, CheckCircle2, XCircle, User, Loader2, X, Car, MapPin, Calendar, Phone, Mail, Plane, FileText, Save, UserCheck, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus } from "@/types";
import toast from "react-hot-toast";

type Driver = { id: string; user: { name: string | null; phone: string | null }; vehicles: { make: string; model: string; licensePlate: string }[] };

type Booking = {
  id: string; confirmationCode: string;
  guestName: string | null; guestEmail: string | null; guestPhone: string | null;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  vehicleClass: string; passengers: number; luggage: number;
  flightNumber: string | null; specialRequests: string | null;
  totalAmount: number; driverAmount: number | null;
  status: BookingStatus; paymentStatus: string;
  driverId: string | null; adminNotes: string | null;
  createdAt: string;
};

const ALL_STATUSES: BookingStatus[] = ["PENDING","CONFIRMED","DRIVER_ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"];

function BookingDrawer({ booking, drivers, onClose, onSaved }: {
  booking: Booking;
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus]           = useState<BookingStatus>(booking.status);
  const [driverId, setDriverId]       = useState(booking.driverId ?? "");
  const [driverAmount, setDriverAmount] = useState(booking.driverAmount?.toString() ?? "");
  const [totalAmount, setTotalAmount] = useState(booking.totalAmount.toString());
  const [adminNotes, setAdminNotes]   = useState(booking.adminNotes ?? "");
  const [saving, setSaving]           = useState(false);

  // Parse meta from specialRequests
  const metaMatch = booking.specialRequests?.match(/\[META\]([\s\S]*?)\[\/META\]/);
  let meta: Record<string, unknown> = {};
  try { if (metaMatch) meta = JSON.parse(metaMatch[1]); } catch { /* */ }
  const cleanNotes = booking.specialRequests?.replace(/\[META\][\s\S]*?\[\/META\]\n?/, "").trim() || null;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          driverId: driverId || undefined,
          driverAmount: driverAmount ? parseFloat(driverAmount) : null,
          totalAmount: parseFloat(totalAmount),
          adminNotes,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Booking updated");
      onSaved();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const assignedDriver = drivers.find((d) => d.id === driverId);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-[#0a0a0a] border-l border-white/[0.08] h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] sticky top-0 bg-[#0a0a0a] z-10">
          <div>
            <p className="text-gold-400 font-mono text-lg tracking-widest">{booking.confirmationCode}</p>
            <p className="text-dark-500 text-xs mt-0.5">{new Date(booking.createdAt).toLocaleString("en-GB")}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/booking/${booking.id}/invoice`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 transition-colors"
              title="View invoice"
            >
              <Receipt size={14} />
            </a>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-dark-400 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-5 overflow-y-auto">

          {/* Client */}
          <section className="glass-card rounded-xl p-4 space-y-2">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-3">Client</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gold-500/10 flex items-center justify-center"><User size={16} className="text-gold-500" /></div>
              <div>
                <p className="text-white font-medium">{booking.guestName ?? "—"}</p>
                <p className="text-dark-400 text-xs">{booking.guestEmail}</p>
              </div>
            </div>
            {booking.guestPhone && <p className="text-dark-400 text-sm flex items-center gap-2"><Phone size={12} className="text-gold-500" />{booking.guestPhone}</p>}
          </section>

          {/* Journey */}
          <section className="glass-card rounded-xl p-4 space-y-2">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-3">Journey</p>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2"><MapPin size={13} className="text-green-400 flex-shrink-0 mt-0.5" /><span className="text-white">{booking.pickupAddress}</span></div>
              <div className="flex gap-2"><MapPin size={13} className="text-red-400 flex-shrink-0 mt-0.5" /><span className="text-dark-300">{booking.dropoffAddress}</span></div>
              <div className="flex gap-2"><Calendar size={13} className="text-gold-500 flex-shrink-0 mt-0.5" /><span className="text-dark-300">{new Date(booking.pickupDatetime).toLocaleString("en-GB")}</span></div>
              <div className="flex gap-2"><Car size={13} className="text-gold-500 flex-shrink-0 mt-0.5" /><span className="text-dark-300">{booking.vehicleClass.replace(/_/g, " ")} · {booking.passengers} pax</span></div>
              {booking.flightNumber && <div className="flex gap-2"><Plane size={13} className="text-blue-400 flex-shrink-0 mt-0.5" /><span className="text-dark-300">Flight: {booking.flightNumber}</span></div>}
              {cleanNotes && <div className="flex gap-2 pt-1 border-t border-white/[0.06]"><FileText size={13} className="text-dark-500 flex-shrink-0 mt-0.5" /><span className="text-dark-400 text-xs">{cleanNotes}</span></div>}
              {(meta.bookingType as string) && (meta.bookingType as string) !== "TRANSFER" && (
                <div className="text-xs text-gold-400/70">Type: {meta.bookingType as string} {meta.durationHours ? `· ${meta.durationHours}h` : ""}</div>
              )}
            </div>
          </section>

          {/* Status */}
          <section className="glass-card rounded-xl p-4">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${status === s ? "bg-gold-500 text-black" : "border border-white/10 text-dark-400 hover:text-white"}`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </section>

          {/* Assign Driver */}
          <section className="glass-card rounded-xl p-4 space-y-3">
            <p className="text-xs text-dark-500 uppercase tracking-wider flex items-center gap-2"><UserCheck size={12} /> Assign Driver</p>
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)}
              className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm">
              <option value="">— Not assigned —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user.name ?? "Unknown"} {d.user.phone ? `(${d.user.phone})` : ""}
                  {d.vehicles?.[0] ? ` · ${d.vehicles[0].make} ${d.vehicles[0].model}` : ""}
                </option>
              ))}
            </select>
            {assignedDriver && (
              <p className="text-xs text-green-400">&#x2713; Assigned: {assignedDriver.user.name}</p>
            )}
          </section>

          {/* Pricing */}
          <section className="glass-card rounded-xl p-4 space-y-3">
            <p className="text-xs text-dark-500 uppercase tracking-wider">Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark-400 block mb-1">Customer Total (€)</label>
                <input type="number" step="0.01" value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="input-luxury w-full px-3 py-2 rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-dark-400 block mb-1">Driver Payment (€) <span className="text-dark-600">· admin only</span></label>
                <input type="number" step="0.01" value={driverAmount}
                  onChange={(e) => setDriverAmount(e.target.value)}
                  placeholder="e.g. 40.00"
                  className="input-luxury w-full px-3 py-2 rounded-lg text-sm border-gold-500/20" />
              </div>
            </div>
            {driverAmount && totalAmount && (
              <p className="text-xs text-dark-500">
                Margin: {formatCurrency(parseFloat(totalAmount) - parseFloat(driverAmount))} ({Math.round((1 - parseFloat(driverAmount) / parseFloat(totalAmount)) * 100)}%)
              </p>
            )}
          </section>

          {/* Admin Notes */}
          <section className="glass-card rounded-xl p-4">
            <label className="text-xs text-dark-500 uppercase tracking-wider block mb-2">Internal Notes</label>
            <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
              rows={3} placeholder="Notes only visible to admin…"
              className="input-luxury w-full px-3 py-2 rounded-lg text-sm resize-none" />
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/[0.06] sticky bottom-0 bg-[#0a0a0a]">
          <button onClick={save} disabled={saving}
            className="btn-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers,  setDrivers]  = useState<Driver[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<BookingStatus | "ALL">("ALL");
  const [selected, setSelected] = useState<Booking | null>(null);

  const load = async () => {
    setLoading(true);
    const [bRes, dRes] = await Promise.all([
      fetch("/api/admin/bookings"),
      fetch("/api/admin/drivers"),
    ]);
    if (bRes.ok) setBookings(await bRes.json());
    if (dRes.ok) {
      const allDrivers = await dRes.json();
      setDrivers(allDrivers.filter((d: { status: string }) => d.status === "APPROVED"));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = bookings.filter((b) => {
    const matchSearch = !search || [b.confirmationCode, b.guestName, b.guestEmail, b.guestPhone, b.pickupAddress]
      .some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === "ALL" || b.status === filter;
    return matchSearch && matchFilter;
  });

  const pendingCount = bookings.filter((b) => b.status === "PENDING").length;

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Bookings</h1>
          <p className="text-dark-400 mt-1">{bookings.length} total · {pendingCount} pending action</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input type="text" placeholder="Search by code, name, phone…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-luxury pl-9 pr-4 py-2.5 rounded-xl text-sm w-72" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["ALL", ...ALL_STATUSES] as (BookingStatus | "ALL")[]).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === s ? "bg-gold-500 text-black" : "border border-white/10 text-dark-400 hover:text-white"
              }`}>
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
              {s === "PENDING" && pendingCount > 0 && (
                <span className="ml-1.5 px-1 py-0.5 rounded-full bg-yellow-500 text-black text-[9px] font-bold">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="text-gold-500 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Code</th>
                  <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Client</th>
                  <th className="hidden md:table-cell text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Phone</th>
                  <th className="hidden sm:table-cell text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Route</th>
                  <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Date</th>
                  <th className="hidden lg:table-cell text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Vehicle</th>
                  <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Amount</th>
                  <th className="hidden lg:table-cell text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Driver Pay</th>
                  <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} onClick={() => setSelected(b)}
                    className="price-row border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-xs font-mono text-gold-400 tracking-widest">{b.confirmationCode}</td>
                    <td className="py-3 px-3">
                      <p className="text-sm text-white whitespace-nowrap">{b.guestName ?? "—"}</p>
                      <p className="text-xs text-dark-500 truncate max-w-[120px]">{b.guestEmail}</p>
                    </td>
                    <td className="hidden md:table-cell py-3 px-3 text-xs text-dark-400 whitespace-nowrap">{b.guestPhone ?? "—"}</td>
                    <td className="hidden sm:table-cell py-3 px-3 text-xs text-dark-400 max-w-[120px]">
                      <p className="truncate">{b.pickupAddress}</p>
                      <p className="truncate text-dark-600">→ {b.dropoffAddress}</p>
                    </td>
                    <td className="py-3 px-3 text-xs text-dark-400 whitespace-nowrap">
                      {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { day:"2-digit", month:"short" })}<br />
                      <span className="text-dark-600">{new Date(b.pickupDatetime).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })}</span>
                    </td>
                    <td className="hidden lg:table-cell py-3 px-3 text-xs text-dark-400 whitespace-nowrap">{b.vehicleClass.replace(/_/g, " ")}</td>
                    <td className="py-3 px-3 text-sm text-gold-400 font-semibold whitespace-nowrap">{formatCurrency(b.totalAmount)}</td>
                    <td className="hidden lg:table-cell py-3 px-3 text-sm whitespace-nowrap">
                      {b.driverAmount != null
                        ? <span className="text-green-400">{formatCurrency(b.driverAmount)}</span>
                        : <span className="text-dark-600">—</span>}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`status-badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button className="px-2.5 py-1 rounded-lg bg-gold-500/10 text-gold-400 text-xs hover:bg-gold-500/20 transition-colors whitespace-nowrap">
                          Open →
                        </button>
                        <a
                          href={`/booking/${b.id}/invoice`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-white/[0.04] text-dark-400 hover:text-white transition-colors"
                          title="View invoice"
                        >
                          <Receipt size={13} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-dark-500">No bookings found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <BookingDrawer
          booking={selected}
          drivers={drivers}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
