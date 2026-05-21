"use client";

import { useEffect, useState } from "react";
import { Loader2, CreditCard, Smartphone, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  bankIban: string | null;
  bankName: string | null;
  bizumPhone: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  driver: {
    id: string;
    user: { name: string | null; email: string };
  };
};

const STATUS_STYLE: Record<string, string> = {
  PENDING:     "bg-yellow-500/20 text-yellow-400",
  COMPLETED:   "bg-blue-500/20 text-blue-400",
  TRANSFERRED: "bg-green-500/20 text-green-400",
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<"ALL" | "PENDING" | "COMPLETED" | "TRANSFERRED">("ALL");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/withdrawals");
    if (res.ok) setWithdrawals(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Marked as ${status.toLowerCase()}`); load(); }
    else toast.error("Failed to update");
  };

  const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length;
  const filtered     = filter === "ALL" ? withdrawals : withdrawals.filter((w) => w.status === filter);
  const totalPending = withdrawals.filter((w) => w.status === "PENDING").reduce((s, w) => s + w.amount, 0);

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Withdrawals</h1>
        <p className="text-dark-400 mt-1">
          {pendingCount > 0
            ? <span className="text-yellow-400">{pendingCount} pending — {formatCurrency(totalPending)} to process</span>
            : "All withdrawals processed"}
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["ALL", "PENDING", "COMPLETED", "TRANSFERRED"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              filter === f
                ? "bg-gold-500 text-black"
                : "border border-white/[0.08] text-dark-400 hover:text-white"
            }`}>
            {f}
            {f === "PENDING" && pendingCount > 0 && (
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
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-dark-500 text-sm">No withdrawals in this category.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Driver", "Method / Details", "Amount", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs text-dark-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="price-row border-b border-white/[0.04]">
                  <td className="py-3 px-4">
                    <p className="text-sm text-white">{w.driver.user.name ?? "—"}</p>
                    <p className="text-xs text-dark-500">{w.driver.user.email}</p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {w.method === "BIZUM"
                        ? <Smartphone size={13} className="text-dark-400" />
                        : <CreditCard  size={13} className="text-dark-400" />
                      }
                      <div>
                        <p className="text-sm text-dark-200">{w.method === "BIZUM" ? "Bizum" : "Bank Transfer"}</p>
                        <p className="text-xs text-dark-500 font-mono">
                          {w.method === "BIZUM" ? w.bizumPhone : (w.bankIban ?? w.bankName ?? "—")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-display text-lg text-gold-400">{formatCurrency(w.amount)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${STATUS_STYLE[w.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-dark-500">
                    {new Date(w.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-3 px-4">
                    {w.status === "PENDING" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => update(w.id, "COMPLETED")}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs transition-colors flex items-center gap-1">
                          <CheckCircle2 size={11} /> Complete
                        </button>
                        <button onClick={() => update(w.id, "TRANSFERRED")}
                          className="px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 text-xs transition-colors flex items-center gap-1">
                          <CheckCircle2 size={11} /> Transfer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
