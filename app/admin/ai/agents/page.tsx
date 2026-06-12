"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, RefreshCw, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Loader2, Clock } from "lucide-react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  isEnabled: boolean;
  totalRuns: number;
  lastRunAt: string | null;
  lastError: string | null;
  avgDurationMs: number;
}

const STATUS_COLOR: Record<string, string> = {
  IDLE:    "text-green-400",
  RUNNING: "text-blue-400",
  ERROR:   "text-red-400",
  PAUSED:  "text-yellow-400",
  STOPPED: "text-dark-500",
};

export default function AgentsPage() {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ai/agents");
      const d = await r.json();
      setAgents(d.agents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(id: string, enabled: boolean) {
    setToggling(id);
    await fetch("/api/ai/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isEnabled: !enabled }),
    });
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, isEnabled: !enabled } : a));
    setToggling(null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bot size={22} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-display text-white">AI Agents</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : (
        <div className="space-y-3">
          {agents.map((a) => (
            <div key={a.id} className="bg-dark-900 border border-white/[0.07] rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold capitalize ${STATUS_COLOR[a.status] ?? "text-white"}`}>{a.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status] ?? "text-white"} bg-white/5`}>{a.status}</span>
                  </div>
                  <p className="text-dark-400 text-xs mb-3">{a.description}</p>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-white text-sm font-medium">{a.totalRuns.toLocaleString()}</p>
                      <p className="text-dark-600 text-[10px] uppercase tracking-wider">Total Runs</p>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{a.avgDurationMs ? `${(a.avgDurationMs / 1000).toFixed(1)}s` : "—"}</p>
                      <p className="text-dark-600 text-[10px] uppercase tracking-wider">Avg Duration</p>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-1">
                        <Clock size={11} className="text-dark-500" />
                        {a.lastRunAt ? new Date(a.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}
                      </p>
                      <p className="text-dark-600 text-[10px] uppercase tracking-wider">Last Run</p>
                    </div>
                  </div>

                  {a.lastError && (
                    <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-400 text-xs font-mono break-all">{a.lastError}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => toggle(a.id, a.isEnabled)}
                  disabled={toggling === a.id}
                  aria-label={a.isEnabled ? "Disable agent" : "Enable agent"}
                  className="flex-shrink-0 mt-1"
                >
                  {toggling === a.id ? (
                    <Loader2 size={22} className="animate-spin text-dark-500" />
                  ) : a.isEnabled ? (
                    <ToggleRight size={28} className="text-green-400 hover:text-green-300 transition-colors" />
                  ) : (
                    <ToggleLeft size={28} className="text-dark-600 hover:text-dark-400 transition-colors" />
                  )}
                </button>
              </div>

              {a.status === "IDLE" && a.isEnabled && (
                <div className="mt-3 flex items-center gap-1 text-green-400 text-xs">
                  <CheckCircle2 size={11} /> Ready
                </div>
              )}
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-16 text-dark-500">
              <Bot size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agents found. Run the seed endpoint first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
