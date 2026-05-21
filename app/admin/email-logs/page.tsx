"use client";

import { useEffect, useState } from "react";
import { Mail, RefreshCw, Filter } from "lucide-react";

type EmailLog = {
  id:        string;
  to:        string;
  subject:   string;
  type:      string;
  status:    string;
  resendId:  string | null;
  bookingId: string | null;
  createdAt: string;
};

type TypeCount = { type: string; _count: { id: number } };

const TYPE_COLORS: Record<string, string> = {
  CONFIRMATION:     "bg-green-500/20 text-green-400",
  WELCOME:          "bg-blue-500/20 text-blue-400",
  ABANDONED:        "bg-orange-500/20 text-orange-400",
  REMINDER:         "bg-purple-500/20 text-purple-400",
  REVIEW:           "bg-yellow-500/20 text-yellow-400",
  NEWSLETTER:       "bg-pink-500/20 text-pink-400",
  DRIVER_ASSIGNED:  "bg-cyan-500/20 text-cyan-400",
  NEWSLETTER_WELCOME: "bg-indigo-500/20 text-indigo-400",
};

export default function EmailLogsPage() {
  const [logs,       setLogs]       = useState<EmailLog[]>([]);
  const [total,      setTotal]      = useState(0);
  const [typeCounts, setTypeCounts] = useState<TypeCount[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/email-logs${typeFilter ? `?type=${typeFilter}` : ""}`;
      const res  = await fetch(url);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setTypeCounts(data.typeCounts ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter]);

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Email Logs</h1>
          <p className="text-dark-400 text-sm mt-1">All transactional & marketing emails · {total} total</p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Type breakdown */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setTypeFilter("")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${!typeFilter ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"}`}
        >
          <Filter size={10} /> All
        </button>
        {typeCounts.map(({ type, _count }) => (
          <button
            key={type}
            onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
              typeFilter === type ? "bg-gold-500 text-black font-medium" : `${TYPE_COLORS[type] ?? "bg-white/[0.04] text-dark-400"} hover:opacity-80`
            }`}
          >
            <span className="capitalize">{type.toLowerCase().replace(/_/g, " ")}</span>
            <span className="opacity-60">({_count.id})</span>
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Sent", value: total },
          { label: "Transactional", value: typeCounts.filter((t) => ["CONFIRMATION","WELCOME","REMINDER","REVIEW","DRIVER_ASSIGNED"].includes(t.type)).reduce((s, t) => s + t._count.id, 0) },
          { label: "Marketing", value: typeCounts.filter((t) => ["ABANDONED","NEWSLETTER","NEWSLETTER_WELCOME"].includes(t.type)).reduce((s, t) => s + t._count.id, 0) },
          { label: "Types", value: typeCounts.length },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card rounded-xl p-4">
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className="font-display text-xl text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["To", "Subject", "Type", "Status", "Sent At"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-400">
                  <Mail size={24} className="mx-auto mb-2 text-dark-600" />
                  No email logs yet
                </td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white text-xs">{log.to}</td>
                  <td className="px-4 py-3 text-dark-300 text-xs max-w-[240px] truncate">{log.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${TYPE_COLORS[log.type] ?? "bg-white/10 text-dark-400"}`}>
                      {log.type.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${log.status === "SENT" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-500 text-xs">{new Date(log.createdAt).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
