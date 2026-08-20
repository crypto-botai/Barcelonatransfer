"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot, RefreshCw, ToggleLeft, ToggleRight, AlertCircle,
  CheckCircle2, Loader2, Clock, Play, Database, XCircle,
} from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  status: string;
  durationMs: number | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  isEnabled: boolean;
  totalRuns: number;
  successRate: number;
  lastRunAt: string | null;
  lastError: string | null;
  avgDurationMs: number;
  errorCount: number;
  memoryCount: number;
  tasks: Task[];
}

const STATUS_COLOR: Record<string, string> = {
  IDLE:    "text-green-400",
  RUNNING: "text-blue-400 animate-pulse",
  ERROR:   "text-red-400",
  WARNING: "text-yellow-400",
  PAUSED:  "text-dark-500",
  OFFLINE: "text-dark-500",
};

const STATUS_BG: Record<string, string> = {
  IDLE:    "bg-green-500/10",
  RUNNING: "bg-blue-500/10",
  ERROR:   "bg-red-500/10",
  WARNING: "bg-yellow-500/10",
  PAUSED:  "bg-dark-800",
  OFFLINE: "bg-dark-800",
};

const TASK_STYLE: Record<string, string> = {
  COMPLETED: "bg-green-500",
  FAILED:    "bg-red-500",
  RUNNING:   "bg-blue-500 animate-pulse",
  QUEUED:    "bg-yellow-500",
};

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AgentsPage() {
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<string | null>(null);
  const [running, setRunning]     = useState<string | null>(null);
  const [runResult, setRunResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

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
    setAgents((prev) => prev.map((a) =>
      a.id === id ? { ...a, isEnabled: !enabled, status: !enabled ? "IDLE" : "PAUSED" } : a
    ));
    setToggling(null);
  }

  async function runNow(agentName: string) {
    setRunning(agentName);
    setRunResult((prev) => ({ ...prev, [agentName]: { ok: true, msg: "Running…" } }));
    try {
      const r = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName }),
      });
      const d = await r.json();
      if (d.ok) {
        setRunResult((prev) => ({ ...prev, [agentName]: { ok: true, msg: `Done in ${(d.durationMs / 1000).toFixed(1)}s` } }));
      } else {
        setRunResult((prev) => ({ ...prev, [agentName]: { ok: false, msg: d.error ?? "Failed" } }));
      }
      // Reload to get updated stats
      await load();
    } catch {
      setRunResult((prev) => ({ ...prev, [agentName]: { ok: false, msg: "Network error" } }));
    } finally {
      setRunning(null);
    }
  }

  // Agents that support manual run
  const RUNNABLE = ["health", "seo", "analytics", "booking"];

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
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-dark-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((a) => {
            const result = runResult[a.name];
            const isRunnable = RUNNABLE.includes(a.name);
            const isCurrentlyRunning = running === a.name;

            return (
              <div key={a.id} className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white text-sm font-semibold capitalize">{a.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[a.status] ?? "text-white"} ${STATUS_BG[a.status] ?? "bg-white/5"}`}>
                        {a.status}
                      </span>
                      {a.memoryCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                          <Database size={9} /> {a.memoryCount} memories
                        </span>
                      )}
                    </div>
                    <p className="text-dark-400 text-xs mb-4">{a.description}</p>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">{a.totalRuns.toLocaleString()}</p>
                        <p className="text-dark-500 text-[10px] uppercase tracking-wider">Runs</p>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${a.successRate >= 80 ? "text-green-400" : a.successRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                          {a.totalRuns > 0 ? `${Math.round(a.successRate)}%` : "—"}
                        </p>
                        <p className="text-dark-500 text-[10px] uppercase tracking-wider">Success</p>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {a.avgDurationMs ? `${(a.avgDurationMs / 1000).toFixed(1)}s` : "—"}
                        </p>
                        <p className="text-dark-500 text-[10px] uppercase tracking-wider">Avg Time</p>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium flex items-center gap-1">
                          <Clock size={11} className="text-dark-500" />
                          {timeAgo(a.lastRunAt)}
                        </p>
                        <p className="text-dark-500 text-[10px] uppercase tracking-wider">Last Run</p>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <button
                      onClick={() => toggle(a.id, a.isEnabled)}
                      disabled={toggling === a.id}
                      aria-label={a.isEnabled ? "Disable" : "Enable"}
                    >
                      {toggling === a.id ? (
                        <Loader2 size={22} className="animate-spin text-dark-500" />
                      ) : a.isEnabled ? (
                        <ToggleRight size={28} className="text-green-400 hover:text-green-300 transition-colors" />
                      ) : (
                        <ToggleLeft size={28} className="text-dark-500 hover:text-dark-400 transition-colors" />
                      )}
                    </button>

                    {isRunnable && a.isEnabled && (
                      <button
                        onClick={() => runNow(a.name)}
                        disabled={!!running}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] hover:bg-[#c9a84c]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isCurrentlyRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                        {isCurrentlyRunning ? "Running…" : "Run Now"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Run result toast */}
                {result && (
                  <div className={`mx-5 mb-4 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${result.ok ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                    {result.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {result.msg}
                  </div>
                )}

                {/* Last error */}
                {a.lastError && (
                  <div className="mx-5 mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-red-400 text-xs font-mono break-all">{a.lastError}</p>
                  </div>
                )}

                {/* Task history mini-timeline */}
                {a.tasks && a.tasks.length > 0 && (
                  <div className="border-t border-white/[0.04] px-5 py-3">
                    <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-2">Last {a.tasks.length} tasks</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {a.tasks.map((t) => (
                        <div
                          key={t.id}
                          title={`${t.status} · ${t.durationMs ? `${(t.durationMs/1000).toFixed(1)}s` : "—"} · ${timeAgo(t.createdAt)}`}
                          className={`w-4 h-4 rounded-sm flex-shrink-0 ${TASK_STYLE[t.status] ?? "bg-dark-700"}`}
                        />
                      ))}
                      <span className="text-dark-500 text-[10px] ml-1">
                        {a.tasks.filter(t => t.status === "COMPLETED").length}/{a.tasks.length} ok
                      </span>
                    </div>
                  </div>
                )}

                {/* Status footer */}
                {a.status === "IDLE" && a.isEnabled && !a.lastError && (
                  <div className="border-t border-white/[0.04] px-5 py-2 flex items-center gap-1.5 text-green-400 text-xs">
                    <CheckCircle2 size={11} /> Ready to run
                  </div>
                )}
              </div>
            );
          })}

          {agents.length === 0 && (
            <div className="text-center py-16 text-dark-500">
              <Bot size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agents found.</p>
              <a href="/api/ai/seed" className="text-xs text-[#c9a84c] underline mt-2 inline-block">Run seed endpoint →</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
