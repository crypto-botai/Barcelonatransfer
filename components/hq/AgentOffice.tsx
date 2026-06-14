"use client";

import { useState, useEffect } from "react";
import type { HQAgent, HQTask } from "@/lib/ai/hqData";
import type { OrgNode } from "./HQClient";
import { statusColor } from "./HQClient";

function timeAgo(d: Date | string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

interface Memory {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

export default function AgentOffice({
  node, agent, allTasks, onClose,
}: {
  node: OrgNode;
  agent?: HQAgent;
  allTasks: HQTask[];
  onClose: () => void;
}) {
  const [tab, setTab]         = useState<"profile" | "tasks" | "memory">("profile");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMem, setLoadingMem] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (tab === "memory" && agent && memories.length === 0) {
      setLoadingMem(true);
      fetch(`/api/ai/memory?agentId=${agent.id}&limit=15`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.memories) setMemories(d.memories); })
        .finally(() => setLoadingMem(false));
    }
  }, [tab, agent, memories.length]);

  // Reset tab and memories when node changes
  useEffect(() => {
    setTab("profile");
    setMemories([]);
  }, [node.id]);

  const agentTasks = agent
    ? allTasks.filter(t => t.agentId === agent.id).slice(0, 15)
    : [];

  const status = agent?.status ?? (node.agentKey ? "NOT_DEPLOYED" : "VIRTUAL");
  const sColor = agent ? statusColor(agent.status) : "#374151";
  const totalToday = (agent?.tasksToday.completed ?? 0) + (agent?.tasksToday.failed ?? 0);

  const TASK_STATUS_STYLE: Record<string, string> = {
    COMPLETED: "#22c55e",
    FAILED:    "#ef4444",
    RUNNING:   "#facc15",
    QUEUED:    "#6b7280",
  };

  const MEMORY_ICONS: Record<string, string> = {
    REPORT: "📄", FINDING: "🔍", METRIC: "📊",
    DECISION: "🎯", OBSERVATION: "👁",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.3s" }}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(520px, 100vw)",
          background: "rgba(6,6,14,0.98)",
          borderLeft: `1px solid ${node.color}33`,
          transform: mounted ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `-20px 0 80px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: node.color }} />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: node.color + "18", border: `1px solid ${node.color}44` }}
            >
              {node.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: node.color }}>
                  {node.dept}
                </span>
                <span className="text-[9px] text-white/20">·</span>
                <span className="text-[9px] text-white/30 capitalize">Level {node.level} — {node.level === 0 ? "Executive" : node.level === 1 ? "Management" : "Operations"}</span>
              </div>
              <h2 className="text-white font-semibold text-base leading-tight mt-0.5">{node.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "RUNNING" ? "animate-pulse" : ""}`}
                  style={{ background: sColor }}
                />
                <span className="text-xs capitalize" style={{ color: sColor }}>
                  {status === "NOT_DEPLOYED" ? "Not Deployed" : status === "VIRTUAL" ? "Virtual Node" : status.toLowerCase()}
                </span>
                {agent && (
                  <>
                    <span className="text-white/20 text-xs">·</span>
                    <span className="text-white/30 text-xs">{agent.isEnabled ? "Enabled" : "Disabled"}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Metrics strip (if agent deployed) */}
        {agent && (
          <div className="grid grid-cols-4 border-b border-white/[0.06]">
            {[
              { label: "Success Rate",   val: `${Math.round(agent.successRate)}%`,   color: agent.successRate >= 80 ? "#22c55e" : "#f59e0b" },
              { label: "Total Runs",     val: `${agent.totalRuns}`,                  color: "#c9a84c" },
              { label: "Tasks Today",    val: `${totalToday}`,                       color: "#3b82f6" },
              { label: "Memory Items",   val: `${agent.memoryCount}`,                color: "#8b5cf6" },
            ].map(m => (
              <div key={m.label} className="py-4 text-center border-r border-white/[0.04] last:border-0">
                <div className="text-lg font-mono font-bold" style={{ color: m.color }}>{m.val}</div>
                <div className="text-[8px] text-white/20 uppercase tracking-wider mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(["profile", "tasks", "memory"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[11px] uppercase tracking-widest font-medium transition-all ${
                tab === t
                  ? "text-white border-b-2"
                  : "text-white/30 hover:text-white/60"
              }`}
              style={tab === t ? { borderBottomColor: node.color } : undefined}
            >
              {t === "profile" ? "Profile" : t === "tasks" ? `Tasks${agentTasks.length > 0 ? ` (${agentTasks.length})` : ""}` : "Memory"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── PROFILE TAB ── */}
          {tab === "profile" && (
            <div className="space-y-6">
              {/* Responsibilities */}
              <div>
                <h3 className="text-[10px] uppercase tracking-widest mb-3" style={{ color: node.color }}>
                  Core Responsibilities
                </h3>
                <ul className="space-y-2">
                  {node.responsibilities.map((r, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="mt-1 flex-shrink-0" style={{ color: node.color }}>▸</span>
                      <span className="text-white/60 text-sm">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Agent details (if deployed) */}
              {agent && (
                <>
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest mb-3 text-white/30">Performance</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Success Rate",       val: `${Math.round(agent.successRate)}%`, pct: agent.successRate,    color: agent.successRate >= 80 ? "#22c55e" : "#f59e0b" },
                        { label: "Tasks Today",        val: `${totalToday}`, pct: Math.min(totalToday * 10, 100), color: "#3b82f6" },
                        { label: "Error Count",        val: `${agent.errorCount}`, pct: Math.min(agent.errorCount * 20, 100), color: agent.errorCount > 0 ? "#ef4444" : "#22c55e" },
                      ].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-white/40 text-xs">{m.label}</span>
                            <span className="text-xs font-mono" style={{ color: m.color }}>{m.val}</span>
                          </div>
                          <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{ width: `${m.pct}%`, background: m.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Avg Duration",  val: agent.avgDurationMs > 0 ? `${(agent.avgDurationMs/1000).toFixed(1)}s` : "N/A" },
                      { label: "Last Run",      val: timeAgo(agent.lastRunAt) },
                      { label: "Total Runs",    val: `${agent.totalRuns}` },
                      { label: "Status",        val: agent.status },
                    ].map(m => (
                      <div key={m.label} className="bg-white/[0.03] rounded-lg p-3">
                        <p className="text-[9px] text-white/20 uppercase tracking-wider">{m.label}</p>
                        <p className="text-white/70 text-sm mt-0.5 capitalize">{m.val}</p>
                      </div>
                    ))}
                  </div>

                  {agent.lastError && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                      <p className="text-red-400 text-[10px] uppercase tracking-widest mb-2">Last Error</p>
                      <p className="text-red-300/70 text-xs leading-relaxed">{agent.lastError}</p>
                    </div>
                  )}
                </>
              )}

              {!agent && node.agentKey && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 text-center">
                  <div className="text-3xl mb-3">🔧</div>
                  <p className="text-white/40 text-sm mb-1">Agent Not Deployed</p>
                  <p className="text-white/20 text-xs">This agent has not been seeded or run yet.</p>
                </div>
              )}

              {node.level === 1 && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <p className="text-white/30 text-xs leading-relaxed">
                    This is a virtual management node. It coordinates worker agents in the {node.dept} department
                    and represents department-level oversight — not a separately deployed AI agent.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── TASKS TAB ── */}
          {tab === "tasks" && (
            <div className="space-y-3">
              {/* Today summary */}
              {agent && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label:"Done",    val: agent.tasksToday.completed, color:"#22c55e" },
                    { label:"Failed",  val: agent.tasksToday.failed,    color:"#ef4444" },
                    { label:"Running", val: agent.tasksToday.running,   color:"#facc15" },
                    { label:"Queued",  val: agent.tasksToday.queued,    color:"#6b7280" },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <div className="font-mono font-bold" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-[8px] text-white/20 uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {agentTasks.length === 0 ? (
                <div className="text-center py-12 text-white/20 text-sm">
                  {agent ? "No tasks in the last 24 hours" : "Agent not deployed — no task history"}
                </div>
              ) : (
                agentTasks.map(t => (
                  <div key={t.id} className="flex gap-3 bg-white/[0.02] rounded-lg p-3">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${t.status === "RUNNING" ? "animate-pulse" : ""}`}
                      style={{ background: TASK_STATUS_STYLE[t.status] ?? "#6b7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs capitalize" style={{ color: TASK_STATUS_STYLE[t.status] ?? "#6b7280" }}>
                          {t.status.toLowerCase()}
                        </span>
                        <span className="text-[9px] text-white/20 font-mono">{timeAgo(t.createdAt)}</span>
                      </div>
                      {t.durationMs && (
                        <p className="text-white/30 text-[10px] mt-0.5">{(t.durationMs / 1000).toFixed(1)}s duration</p>
                      )}
                      {t.error && (
                        <p className="text-red-400/60 text-[10px] mt-0.5 line-clamp-2">{t.error}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── MEMORY TAB ── */}
          {tab === "memory" && (
            <div className="space-y-3">
              {loadingMem && (
                <div className="text-center py-8 text-white/20 text-xs">Loading memories…</div>
              )}
              {!loadingMem && memories.length === 0 && (
                <div className="text-center py-12 text-white/20 text-sm">
                  {agent ? "No memories stored yet" : "Agent not deployed"}
                </div>
              )}
              {memories.map(m => (
                <div key={m.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{MEMORY_ICONS[m.type] ?? "📌"}</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: node.color }}>
                      {m.type}
                    </span>
                    <span className="text-white/20 text-[9px] ml-auto font-mono">{timeAgo(m.createdAt)}</span>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
          {agent && (
            <a
              href={`/admin/ai/agents`}
              className="flex-1 py-2 rounded-lg text-center text-xs font-medium transition-all"
              style={{ background: node.color + "18", color: node.color, border: `1px solid ${node.color}44` }}
            >
              Manage Agent
            </a>
          )}
          <a
            href="/admin/ai/activity"
            className="flex-1 py-2 rounded-lg text-center text-xs font-medium bg-white/[0.04] text-white/40 border border-white/[0.06] hover:text-white/60 transition-colors"
          >
            View All Activity
          </a>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-lg text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
