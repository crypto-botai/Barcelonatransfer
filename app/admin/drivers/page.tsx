"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, User, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type Driver = {
  id: string;
  status: string;
  rating: number;
  totalRides: number;
  user: { name: string | null; email: string; phone: string | null };
  createdAt: string;
};

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/drivers");
    if (res.ok) setDrivers(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve  = async (id: string) => updateDriver(id, "APPROVED");
  const suspend  = async (id: string) => updateDriver(id, "SUSPENDED");

  const updateDriver = async (id: string, status: string) => {
    const res = await fetch(`/api/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Driver ${status.toLowerCase()}`); load(); }
    else toast.error("Failed to update driver");
  };

  const STATUS_STYLE: Record<string, string> = {
    PENDING_APPROVAL: "bg-yellow-500/20 text-yellow-400",
    APPROVED: "bg-green-500/20 text-green-400",
    SUSPENDED: "bg-red-500/20 text-red-400",
    ONLINE: "bg-emerald-500/20 text-emerald-400",
    OFFLINE: "bg-gray-500/20 text-gray-400",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white">Drivers</h1>
        <p className="text-dark-400 mt-1">{drivers.length} registered drivers</p>
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
              {drivers.map((d) => (
                <tr key={d.id} className="price-row border-b border-white/[0.04]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold-500/10 flex items-center justify-center">
                        <User size={16} className="text-gold-500" />
                      </div>
                      <p className="text-sm text-white">{d.user.name ?? "—"}</p>
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
                    <div className="flex gap-2">
                      {d.status === "PENDING_APPROVAL" && (
                        <button onClick={() => approve(d.id)}
                          className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors" title="Approve">
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {d.status !== "SUSPENDED" && (
                        <button onClick={() => suspend(d.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Suspend">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-dark-500">No drivers registered yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
