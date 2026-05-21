"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, User, Loader2,
  FileText, Image as ImageIcon, Shield,
  MessageCircle, ExternalLink, ChevronDown, ChevronUp,
  CreditCard, Smartphone
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
  createdAt: string;
};

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
        <td className="py-3 px-4">
          <p className="text-xs text-dark-300">{d.user.email}</p>
          <p className="text-xs text-dark-500">{d.user.phone ?? "—"}</p>
        </td>
        <td className="py-3 px-4">
          <span className={`status-badge ${STATUS_STYLE[d.status] ?? "bg-gray-500/20 text-gray-400"}`}>
            {d.status.replace(/_/g, " ")}
          </span>
        </td>
        <td className="py-3 px-4 text-sm text-gold-400">{d.rating > 0 ? `${d.rating.toFixed(1)}★` : "—"}</td>
        <td className="py-3 px-4 text-sm text-dark-300">{d.totalRides}</td>
        <td className="py-3 px-4 text-xs text-dark-500">
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
  const [drivers,  setDrivers]  = useState<Driver[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED">("ALL");

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
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Drivers</h1>
        <p className="text-dark-400 mt-1">{drivers.length} registered drivers</p>
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Driver", "Contact", "Status", "Rating", "Rides", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">{h}</th>
                ))}
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
        )}
      </div>
    </div>
  );
}
