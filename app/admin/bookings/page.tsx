"use client";

import { useEffect, useState } from "react";
import { Search, CheckCircle2, XCircle, User, Loader2, X, Car, MapPin, Calendar, Phone, Mail, Plane, FileText, Save, UserCheck, Receipt, Trash2, RotateCcw, Clock, CheckCheck, Archive } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS, type BookingStatus, vehicleClassLabel } from "@/types";
import { parseBookingMeta, formatExtraLine } from "@/lib/booking-meta";
import toast from "react-hot-toast";
import IssueInvoiceButton from "@/components/admin/IssueInvoiceButton";
import RideTimeline from "@/components/admin/RideTimeline";

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
  isDeleted: boolean; deletedAt: string | null;
  createdAt: string;
};

type MainTab = "ALL" | "PENDING" | "COMPLETED" | "DELETED";

const ALL_STATUSES: BookingStatus[] = ["PENDING","CONFIRMED","DRIVER_ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"];

function BookingDrawer({ booking, drivers, onClose, onSaved, onDeleted }: {
  booking: Booking;
  drivers: Driver[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [status, setStatus]             = useState<BookingStatus>(booking.status);
  const [driverId, setDriverId]         = useState(booking.driverId ?? "");
  const [driverAmount, setDriverAmount] = useState(booking.driverAmount?.toString() ?? "");
  const [totalAmount, setTotalAmount]   = useState(booking.totalAmount.toString());
  const [adminNotes, setAdminNotes]     = useState(booking.adminNotes ?? "");
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Extras, the booking type and the member tier all live in the metadata block
  // on specialRequests. This used to read only bookingType, so a baby seat or a
  // name board the customer had paid for never appeared anywhere in the admin.
  const meta = parseBookingMeta(booking.specialRequests);
  const cleanNotes = meta.notes;

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

  const softDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDeleted: true }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Booking moved to Deleted");
      onDeleted();
    } catch {
      toast.error("Failed to delete booking");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
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
            {/* Customers ask for a VAT invoice on WhatsApp; this is where it
                actually gets issued. Only shown once the booking is paid —
                issuing against unpaid money would put a tax document into the
                sequence for a fare not received. */}
            {booking.paymentStatus === "PAID" && (
              <IssueInvoiceButton
                bookingId={booking.id}
                netAmount={booking.totalAmount}
              />
            )}
            <a
              href={`/booking/${booking.id}/invoice`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 transition-colors"
              title="View receipt / invoice"
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
              <div className="flex gap-2"><Calendar size={13} className="text-gold-500 flex-shrink-0 mt-0.5" /><span className="text-dark-300">{new Date(booking.pickupDatetime).toLocaleString("en-GB", { timeZone: "Europe/Madrid", })}</span></div>
              <div className="flex gap-2"><Car size={13} className="text-gold-500 flex-shrink-0 mt-0.5" /><span className="text-dark-300">{vehicleClassLabel(booking.vehicleClass)} · {booking.passengers} pax · {booking.luggage} bags</span></div>
              {booking.flightNumber && <div className="flex gap-2"><Plane size={13} className="text-blue-400 flex-shrink-0 mt-0.5" /><span className="text-dark-300">Flight: {booking.flightNumber}</span></div>}
              {cleanNotes && <div className="flex gap-2 pt-1 border-t border-white/[0.06]"><FileText size={13} className="text-dark-500 flex-shrink-0 mt-0.5" /><span className="text-dark-400 text-xs">{cleanNotes}</span></div>}
              {meta.bookingType && meta.bookingType !== "TRANSFER" && (
                <div className="text-xs text-gold-400/70">Type: {meta.bookingType} {meta.durationHours ? `· ${meta.durationHours}h` : ""}</div>
              )}
            </div>
          </section>

          {/* Extras — what the customer paid for on top of the fare, and what
              the driver has to bring. Given a section of its own rather than a
              line in the notes, because a missing child seat ruins the journey. */}
          {meta.extras.length > 0 && (
            <section className="glass-card rounded-xl p-4 border border-gold-500/20">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-dark-500 uppercase tracking-wider">Extras Booked</p>
                {meta.extrasCost > 0 && (
                  <span className="text-xs text-gold-400 font-medium">{formatCurrency(meta.extrasCost)}</span>
                )}
              </div>
              <ul className="space-y-1.5">
                {meta.extras.map((e) => (
                  <li key={e.id || e.label} className="flex items-start gap-2 text-sm">
                    <CheckCheck size={13} className="text-gold-500 flex-shrink-0 mt-0.5" />
                    <span className="text-dark-200">{formatExtraLine(e)}</span>
                  </li>
                ))}
              </ul>
              {meta.memberTier && meta.memberTier !== "Silver" && (
                <p className="text-xs text-dark-500 mt-3 pt-2 border-t border-white/[0.06]">
                  Member tier: <span className="text-gold-400">{meta.memberTier}</span>
                </p>
              )}
            </section>
          )}

          {/* Live flight status + stage-by-stage history */}
          <RideTimeline bookingId={booking.id} flightNumber={booking.flightNumber} />

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

          {/* Danger Zone */}
          <section className="glass-card rounded-xl p-4 border border-red-500/20">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-3">Danger Zone</p>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} />
                Move to Deleted
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-300">This booking will be hidden and moved to the Deleted tab. You can restore it anytime.</p>
                <div className="flex gap-2">
                  <button
                    onClick={softDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
                  >
                    {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg border border-white/10 text-dark-400 text-xs hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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

function DeletedBookingRow({ b, onRestore }: { b: Booking; onRestore: (id: string) => void }) {
  const [restoring, setRestoring] = useState(false);

  const restore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/bookings/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDeleted: false }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Booking restored");
      onRestore(b.id);
    } catch {
      toast.error("Failed to restore");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <tr className="price-row border-b border-white/[0.04]">
      <td className="py-3 px-3 text-xs font-mono text-dark-500 tracking-widest line-through">{b.confirmationCode}</td>
      <td className="py-3 px-3">
        <p className="text-sm text-dark-400 whitespace-nowrap">{b.guestName ?? "—"}</p>
        <p className="text-xs text-dark-600 truncate max-w-[120px]">{b.guestEmail}</p>
      </td>
      <td className="hidden md:table-cell py-3 px-3 text-xs text-dark-500 whitespace-nowrap">{b.guestPhone ?? "—"}</td>
      <td className="hidden sm:table-cell py-3 px-3 text-xs text-dark-500 max-w-[120px]">
        <p className="truncate">{b.pickupAddress}</p>
        <p className="truncate text-dark-600">→ {b.dropoffAddress}</p>
      </td>
      <td className="py-3 px-3 text-xs text-dark-500 whitespace-nowrap">
        {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { timeZone: "Europe/Madrid", day:"2-digit", month:"short" })}<br />
        <span className="text-dark-600">{new Date(b.pickupDatetime).toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour:"2-digit", minute:"2-digit" })}</span>
      </td>
      <td className="hidden lg:table-cell py-3 px-3 text-xs text-dark-500 whitespace-nowrap">{b.vehicleClass.replace(/_/g, " ")}</td>
      <td className="py-3 px-3 text-sm text-dark-500 font-semibold whitespace-nowrap">{formatCurrency(b.totalAmount)}</td>
      <td className="py-3 px-3">
        <span className={`status-badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
      </td>
      <td className="py-3 px-3">
        <button
          onClick={restore}
          disabled={restoring}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] text-dark-300 text-xs hover:bg-white/[0.10] hover:text-white transition-colors whitespace-nowrap"
        >
          {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
          Restore
        </button>
      </td>
    </tr>
  );
}

const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  { id: "ALL",       label: "All Bookings", icon: <Archive size={14} /> },
  { id: "PENDING",   label: "Pending",      icon: <Clock size={14} /> },
  { id: "COMPLETED", label: "Completed",    icon: <CheckCheck size={14} /> },
  { id: "DELETED",   label: "Deleted",      icon: <Trash2 size={14} /> },
];

export default function AdminBookingsPage() {
  const [bookings,  setBookings]  = useState<Booking[]>([]);
  const [deleted,   setDeleted]   = useState<Booking[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<BookingStatus | "ALL">("ALL");
  const [mainTab,   setMainTab]   = useState<MainTab>("ALL");
  const [selected,  setSelected]  = useState<Booking | null>(null);

  const loadBookings = async () => {
    const res = await fetch("/api/admin/bookings");
    if (res.ok) setBookings(await res.json());
  };

  const loadDeleted = async () => {
    const res = await fetch("/api/admin/bookings?deleted=true");
    if (res.ok) setDeleted(await res.json());
  };

  const loadDrivers = async () => {
    const res = await fetch("/api/admin/drivers");
    if (res.ok) {
      const all = await res.json();
      setDrivers(all.filter((d: { status: string }) => d.status === "APPROVED"));
    }
  };

  const load = async () => {
    setLoading(true);
    await Promise.all([loadBookings(), loadDeleted(), loadDrivers()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // When switching to DELETED tab, ensure data is fresh
  useEffect(() => {
    if (mainTab === "DELETED") loadDeleted();
  }, [mainTab]);

  // Determine the status pre-filter from the main tab
  const tabStatusFilter: BookingStatus | "ALL" =
    mainTab === "PENDING"   ? "PENDING"   :
    mainTab === "COMPLETED" ? "COMPLETED" :
    filter;

  const activeFilter = mainTab === "ALL" ? filter : tabStatusFilter;

  const filtered = bookings.filter((b) => {
    const matchSearch = !search || [b.confirmationCode, b.guestName, b.guestEmail, b.guestPhone, b.pickupAddress]
      .some((v) => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = activeFilter === "ALL" || b.status === activeFilter;
    return matchSearch && matchFilter;
  });

  const pendingCount   = bookings.filter((b) => b.status === "PENDING").length;
  const completedCount = bookings.filter((b) => b.status === "COMPLETED").length;
  const deletedCount   = deleted.length;

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Bookings</h1>
          <p className="text-dark-400 mt-1">{bookings.length} total · {pendingCount} pending action</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {MAIN_TABS.map((tab) => {
          const count = tab.id === "PENDING" ? pendingCount : tab.id === "COMPLETED" ? completedCount : tab.id === "DELETED" ? deletedCount : null;
          return (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); if (tab.id !== "ALL") setFilter("ALL"); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                mainTab === tab.id
                  ? tab.id === "DELETED"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-gold-500 text-black"
                  : "text-dark-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {count !== null && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  mainTab === tab.id
                    ? tab.id === "DELETED" ? "bg-red-500/30 text-red-300" : "bg-black/20 text-black"
                    : tab.id === "DELETED" ? "bg-red-500/20 text-red-400" : "bg-yellow-500 text-black"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {mainTab === "DELETED" ? (
        /* ── Deleted Bookings View ── */
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
                    <th className="text-left py-3 px-3 text-xs text-dark-400 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {deleted.map((b) => (
                    <DeletedBookingRow key={b.id} b={b} onRestore={(id) => setDeleted((prev) => prev.filter((x) => x.id !== id))} />
                  ))}
                  {deleted.length === 0 && (
                    <tr><td colSpan={9} className="py-10 text-center text-dark-500">No deleted bookings.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Active / Pending / Completed View ── */
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <input type="text" placeholder="Search by code, name, phone…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-luxury pl-9 pr-4 py-2.5 rounded-xl text-sm w-72" />
            </div>
            {/* Status sub-filters — only show when on All Bookings tab */}
            {mainTab === "ALL" && (
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
            )}
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
                          {new Date(b.pickupDatetime).toLocaleDateString("en-GB", { timeZone: "Europe/Madrid", day:"2-digit", month:"short" })}<br />
                          <span className="text-dark-600">{new Date(b.pickupDatetime).toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour:"2-digit", minute:"2-digit" })}</span>
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
        </>
      )}

      {selected && (
        <BookingDrawer
          booking={selected}
          drivers={drivers}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); loadBookings(); }}
          onDeleted={() => { setSelected(null); loadBookings(); loadDeleted(); }}
        />
      )}
    </div>
  );
}
