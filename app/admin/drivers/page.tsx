"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, User, Loader2,
  FileText, Image as ImageIcon, Shield,
  MessageCircle, ExternalLink, ChevronDown, ChevronUp,
  CreditCard, Smartphone, Plus, X, Car, Copy,
} from "lucide-react";
import toast from "react-hot-toast";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  bankIban: string | null;
  bankName: string | null;
  bizumPhone: string | null;
  status: string;
  createdAt: string;
};

type Driver = {
  id: string;
  status: string;
  rating: number;
  totalRides: number;
  whatsappNumber: string | null;
  licenseFileUrl: string | null;
  vehiclePermitUrl: string | null;
  vehiclePhotoFront: string | null;
  vehiclePhotoBack: string | null;
  insuranceUrl: string | null;
  user: { name: string | null; email: string; phone: string | null };
  withdrawals: Withdrawal[];
  vehicles: { make: string; model: string; licensePlate: string }[];
  createdAt: string;
};

const VEHICLE_CLASS_OPTIONS = [
  { value: "ECONOMY",        label: "Economy Sedan" },
  { value: "BUSINESS",       label: "Business Sedan" },
  { value: "LUXURY",         label: "Luxury Sedan" },
  { value: "ELECTRIC_VIP",   label: "Electric VIP" },
  { value: "MINIVAN",        label: "Minivan" },
  { value: "LUXURY_MINIVAN", label: "Luxury Minivan" },
  { value: "MINIBUS",        label: "Minibus" },
];

function AddDriverModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name,         setName]         = useState("");
  const [phone,        setPhone]        = useState("");
  const [email,        setEmail]        = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleClass, setVehicleClass] = useState("BUSINESS");
  const [saving,       setSaving]       = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, vehiclePlate, vehicleClass }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to create driver"); return; }
      setTempPassword(data.tempPassword);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = () => {
    if (tempPassword) { navigator.clipboard.writeText(tempPassword); toast.success("Copied!"); }
  };

  const inputCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold-500/50 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-gradient-to-r from-gold-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center">
              <User size={15} className="text-gold-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Add Driver Manually</h2>
              <p className="text-[11px] text-white/30">Driver will be auto-approved</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {tempPassword ? (
          /* Success state — show temp password */
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Driver created!</p>
              <p className="text-white/40 text-xs">Share this temporary password with the driver. They must change it on first login.</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 bg-black/40 border border-white/[0.08] rounded-xl">
              <span className="flex-1 text-gold-400 font-mono font-semibold tracking-wider">{tempPassword}</span>
              <button onClick={copyPassword} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/30 hover:text-white transition-colors">
                <Copy size={14} />
              </button>
            </div>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gold-500 text-black text-sm font-semibold hover:bg-gold-400 transition-colors">
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-[10px] text-gold-400/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Driver Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] text-gold-400/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Phone / WhatsApp</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 6XX XXX XXX" required className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] text-gold-400/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Email (for login)</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="driver@example.com" required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gold-400/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Vehicle Plate</label>
                <div className="relative">
                  <Car size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-400/40" />
                  <input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} placeholder="0000 AAA" required className={`${inputCls} pl-8 uppercase`} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gold-400/70 uppercase tracking-[0.15em] font-semibold mb-1.5">Vehicle Class</label>
                <select value={vehicleClass} onChange={e => setVehicleClass(e.target.value)} className={`${inputCls} appearance-none`}>
                  {VEHICLE_CLASS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/40 text-sm hover:text-white hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gold-500 text-black text-sm font-semibold hover:bg-gold-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {saving ? "Creating…" : "Add Driver"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400",
  APPROVED:         "bg-green-500/20 text-green-400",
  SUSPENDED:        "bg-red-500/20 text-red-400",
  ONLINE:           "bg-emerald-500/20 text-emerald-400",
  OFFLINE:          "bg-gray-500/20 text-gray-400",
  ON_RIDE:          "bg-blue-500/20 text-blue-400",
};

const WITHDRAWAL_STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-yellow-500/20 text-yellow-400",
  COMPLETED:   "bg-blue-500/20 text-blue-400",
  TRANSFERRED: "bg-green-500/20 text-green-400",
};

function DocLink({ url, label, icon: Icon }: { url: string | null; label: string; icon: React.ElementType }) {
  const [preview, setPreview] = useState(false);

  if (!url || url.startsWith("[pending:")) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-dark-500 text-xs">
        <Icon size={11} /> {url ? `${label} (pending)` : `No ${label}`}
      </span>
    );
  }

  const isImage = url.startsWith("data:image") || /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  const isData  = url.startsWith("data:");

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => isImage ? setPreview(!preview) : undefined}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs hover:bg-gold-500/15 transition-colors"
      >
        <Icon size={11} /> {label}
        {isData
          ? (isImage ? <span>(view)</span> : <a href={url} download={label} className="text-gold-300 hover:underline">↓ download</a>)
          : <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={10} /></a>
        }
      </button>
      {isImage && preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="max-w-[240px] max-h-[180px] rounded-lg object-contain border border-white/10" />
          <button onClick={() => setPreview(false)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center">✕</button>
        </div>
      )}
    </div>
  );
}

function DriverRow({ d, onUpdate }: { d: Driver; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updatingWithdrawal, setUpdatingWithdrawal] = useState<string | null>(null);

  const approve = () => updateDriver(d.id, "APPROVED");
  const suspend = () => updateDriver(d.id, "SUSPENDED");

  const updateDriver = async (id: string, status: string) => {
    const res = await fetch(`/api/drivers/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Driver ${status.toLowerCase()}`); onUpdate(); }
    else toast.error("Failed to update driver");
  };

  const updateWithdrawal = async (withdrawalId: string, status: string) => {
    setUpdatingWithdrawal(withdrawalId);
    const res = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Withdrawal marked ${status.toLowerCase()}`); onUpdate(); }
    else toast.error("Failed to update withdrawal");
    setUpdatingWithdrawal(null);
  };

  const hasDocs = d.licenseFileUrl || d.vehiclePermitUrl || d.vehiclePhotoFront || d.vehiclePhotoBack || d.insuranceUrl;
  const pendingWithdrawals = d.withdrawals.filter(w => w.status === "PENDING");

  return (
    <>
      <tr className="price-row border-b border-white/[0.04]">
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold-500/10 flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-gold-500" />
            </div>
            <div>
              <p className="text-sm text-white">{d.user.name ?? "—"}</p>
              {d.whatsappNumber && (
                <p className="text-xs text-green-400/70 flex items-center gap-1 mt-0.5">
                  <MessageCircle size={10} /> {d.whatsappNumber}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="hidden md:table-cell py-3 px-4">
          <p className="text-xs text-dark-300">{d.user.email}</p>
          <p className="text-xs text-dark-500">{d.user.phone ?? "—"}</p>
          {d.vehicles?.[0] && (
            <p className="text-xs text-gold-500/70 font-mono mt-0.5 flex items-center gap-1">
              <Car size={10} className="text-gold-500/50" />
              {d.vehicles[0].licensePlate}
            </p>
          )}
        </td>
        <td className="py-3 px-4">
          <span className={`status-badge ${STATUS_STYLE[d.status] ?? "bg-gray-500/20 text-gray-400"}`}>
            {d.status.replace(/_/g, " ")}
          </span>
        </td>
        <td className="hidden lg:table-cell py-3 px-4 text-sm text-gold-400">{d.rating > 0 ? `${d.rating.toFixed(1)}★` : "—"}</td>
        <td className="hidden lg:table-cell py-3 px-4 text-sm text-dark-300">{d.totalRides}</td>
        <td className="hidden lg:table-cell py-3 px-4 text-xs text-dark-500">
          {new Date(d.createdAt).toLocaleDateString("en-GB")}
        </td>
        <td className="py-3 px-4">
          <div className="flex gap-2 items-center">
            {d.status === "PENDING_APPROVAL" && (
              <button onClick={approve}
                className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors" title="Approve">
                <CheckCircle2 size={14} />
              </button>
            )}
            {d.status !== "SUSPENDED" && (
              <button onClick={suspend}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Suspend">
                <XCircle size={14} />
              </button>
            )}
            {(hasDocs || d.withdrawals.length > 0) && (
              <button onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg bg-white/[0.04] text-dark-400 hover:text-white transition-colors"
                title="View details">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            {pendingWithdrawals.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
                {pendingWithdrawals.length}
              </span>
            )}
          </div>
        </td>
      </tr>

      {expanded && (hasDocs || d.withdrawals.length > 0) && (
        <tr className="border-b border-white/[0.04] bg-white/[0.01]">
          <td colSpan={7} className="px-4 pb-4 pt-2">
            {hasDocs && (
              <div className="mb-4">
                <p className="text-dark-500 text-xs uppercase tracking-wider mb-2">Documents</p>
                <div className="flex flex-wrap gap-2">
                  <DocLink url={d.licenseFileUrl}    label="Driving Licence"       icon={FileText}   />
                  <DocLink url={d.vehiclePermitUrl}  label="Vehicle Permit"        icon={FileText}   />
                  <DocLink url={d.vehiclePhotoFront} label="Photo Front"           icon={ImageIcon}  />
                  <DocLink url={d.vehiclePhotoBack}  label="Photo Back"            icon={ImageIcon}  />
                  <DocLink url={d.insuranceUrl}      label="Insurance"             icon={Shield}     />
                </div>
              </div>
            )}

            {d.withdrawals.length > 0 && (
              <div>
                <p className="text-dark-500 text-xs uppercase tracking-wider mb-2">Withdrawal Requests</p>
                <div className="space-y-2">
                  {d.withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        {w.method === "BIZUM"
                          ? <Smartphone size={13} className="text-dark-400" />
                          : <CreditCard  size={13} className="text-dark-400" />
                        }
                        <span className="text-sm text-white font-display">€{w.amount.toFixed(2)}</span>
                        <span className="text-xs text-dark-400">
                          {w.method === "BIZUM" ? w.bizumPhone : (w.bankIban ?? w.bankName ?? "—")}
                        </span>
                        <span className="text-xs text-dark-600">
                          {new Date(w.createdAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                      <span className={`status-badge ${WITHDRAWAL_STATUS_STYLE[w.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                        {w.status}
                      </span>
                      {w.status === "PENDING" && (
                        <div className="flex gap-1.5">
                          <button
                            disabled={updatingWithdrawal === w.id}
                            onClick={() => updateWithdrawal(w.id, "COMPLETED")}
                            className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs transition-colors"
                          >
                            Mark Completed
                          </button>
                          <button
                            disabled={updatingWithdrawal === w.id}
                            onClick={() => updateWithdrawal(w.id, "TRANSFERRED")}
                            className="px-2 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs transition-colors"
                          >
                            Mark Transferred
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminDriversPage() {
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED">("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/drivers");
    if (res.ok) setDrivers(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingCount = drivers.filter((d) => d.status === "PENDING_APPROVAL").length;
  const filtered     = filter === "ALL" ? drivers : drivers.filter((d) => d.status === filter);

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      {showAddModal && (
        <AddDriverModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { load(); }}
        />
      )}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-white">Drivers</h1>
          <p className="text-dark-400 mt-1">{drivers.length} registered drivers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-500 text-black text-sm font-semibold hover:bg-gold-400 transition-colors"
        >
          <Plus size={15} /> Add Driver
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["ALL", "PENDING_APPROVAL", "APPROVED", "SUSPENDED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              filter === f
                ? "bg-gold-500 text-black"
                : "border border-white/[0.08] text-dark-400 hover:text-white"
            }`}
          >
            {f.replace(/_/g, " ")}
            {f === "PENDING_APPROVAL" && pendingCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-yellow-500 text-black font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
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
                <th className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Driver</th>
                <th className="hidden md:table-cell text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Contact</th>
                <th className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Status</th>
                <th className="hidden lg:table-cell text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Rating</th>
                <th className="hidden lg:table-cell text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Rides</th>
                <th className="hidden lg:table-cell text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Joined</th>
                <th className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <DriverRow key={d.id} d={d} onUpdate={load} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-dark-500">No drivers in this category.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
