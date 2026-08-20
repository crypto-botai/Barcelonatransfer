"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, RefreshCw, Loader2, CheckCheck, AlertTriangle, Info, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Alert {
  id: string;
  agentId: string | null;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  INFO:     <Info size={14} className="text-blue-400" />,
  WARNING:  <AlertTriangle size={14} className="text-yellow-400" />,
  CRITICAL: <AlertCircle size={14} className="text-red-400" />,
};

const SEVERITY_BG: Record<string, string> = {
  INFO:     "border-blue-500/20",
  WARNING:  "border-yellow-500/20",
  CRITICAL: "border-red-500/20",
};

export default function AlertsPage() {
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all"|"unread"|"critical">("unread");
  const [acting, setActing]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "unread" ? "?isRead=false" : filter === "critical" ? "?severity=CRITICAL" : "";
      const r = await fetch(`/api/ai/alerts${params}&limit=50`);
      const d = await r.json();
      setAlerts(d.alerts ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await fetch("/api/ai/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "read" }),
    });
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
  }

  async function dismiss(id: string) {
    await fetch("/api/ai/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "dismiss" }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function markAllRead() {
    setActing(true);
    await fetch("/api/ai/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read_all" }),
    });
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setActing(false);
  }

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell size={22} className="text-yellow-400" />
          <div>
            <h1 className="text-xl font-display text-white">
              Alerts
              {unreadCount > 0 && <span className="ml-2 text-sm text-red-400">({unreadCount} unread)</span>}
            </h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={acting} className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
              {acting ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Mark all read
            </button>
          )}
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5">
        {(["unread", "all", "critical"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${filter === f ? "bg-[#c9a84c] text-black font-medium" : "bg-dark-900 border border-white/[0.07] text-dark-400 hover:text-white"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-dark-900 border rounded-xl px-4 py-3 transition-opacity ${alert.isRead ? "opacity-60" : ""} ${SEVERITY_BG[alert.severity] ?? "border-white/[0.07]"}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0">{SEVERITY_ICON[alert.severity] ?? <Info size={14} />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{alert.title}</p>
                  <p className="text-dark-400 text-xs mt-0.5">{alert.message}</p>
                  <p className="text-dark-500 text-[10px] mt-1.5">{new Date(alert.createdAt).toLocaleString("en-GB")}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!alert.isRead && (
                    <button onClick={() => markRead(alert.id)} className="text-[11px] text-dark-400 hover:text-white transition-colors px-2 py-1 rounded border border-white/[0.07]">
                      Read
                    </button>
                  )}
                  <button onClick={() => dismiss(alert.id)} className="text-[11px] text-dark-500 hover:text-red-400 transition-colors px-2 py-1 rounded border border-white/[0.07]">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="text-center py-16 text-dark-500">
              <Bell size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No alerts. All clear! ✓</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
