/**
 * Agent Reports — /admin/hq/reports
 *
 * Per-agent live dashboard showing:
 *  • Current status + last run time
 *  • Today's task counts (queued / running / completed / failed)
 *  • Success rate + average duration
 *  • Which AI provider/model is assigned (primary + key health)
 *  • Scrollable activity log (last 20 events per agent)
 *  • Latest memory/report saved by this agent
 *  • One-click manual trigger
 */

import { getServerSession } from "next-auth";
import { redirect }         from "next/navigation";
import { authOptions }      from "@/lib/auth";
import { prisma }           from "@/lib/prisma";
import { getProviderInfo }  from "@/lib/ai/providers";
import Link                 from "next/link";
import { AgentRunButton }   from "./AgentRunButton";
import { KeyHealthBadge }   from "./KeyHealthBadge";
import {
  ArrowLeft, Activity, CheckCircle2, XCircle,
  Clock, AlertTriangle, Bot, Database, Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent Reports | Admin", robots: { index: false } };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: Date | null): string {
  if (!d) return "Never";
  const diff = Date.now() - d.getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h    = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatMs(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_COLOR: Record<string, string> = {
  RUNNING:  "bg-blue-400 animate-pulse",
  IDLE:     "bg-green-400",
  WARNING:  "bg-yellow-400",
  ERROR:    "bg-red-400",
  PAUSED:   "bg-dark-500",
  OFFLINE:  "bg-dark-600",
};

const LOG_LEVEL_COLOR: Record<string, string> = {
  info:  "text-dark-400",
  warn:  "text-yellow-400",
  error: "text-red-400",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AgentReportsPage() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const providers = getProviderInfo();

  // Fetch all agents with their tasks, logs, and latest memory
  const agents = await prisma.aiAgent.findMany({ orderBy: { name: "asc" } });

  const agentData = await Promise.all(
    agents.map(async (agent) => {
      const [taskStats, recentLogs, latestMemory, totalSpent] = await Promise.all([
        prisma.aiTask.groupBy({
          by:    ["status"],
          where: { agentId: agent.id, createdAt: { gte: today } },
          _count: true,
        }),
        prisma.aiLog.findMany({
          where:   { agentId: agent.id },
          orderBy: { createdAt: "desc" },
          take:    20,
          select:  { action: true, message: true, level: true, createdAt: true, durationMs: true, tokensUsed: true },
        }),
        prisma.aiMemory.findFirst({
          where:   { agentId: agent.id },
          orderBy: { createdAt: "desc" },
          select:  { title: true, content: true, type: true, createdAt: true },
        }),
        prisma.aiLog.aggregate({
          where: { agentId: agent.id },
          _sum:  { costCents: true, tokensUsed: true },
        }),
      ]);

      const providerConfig = providers.find((p) => p.agent === agent.name);
      const tasks = {
        completed: taskStats.find((t) => t.status === "COMPLETED")?._count ?? 0,
        failed:    taskStats.find((t) => t.status === "FAILED")?._count    ?? 0,
        running:   taskStats.find((t) => t.status === "RUNNING")?._count   ?? 0,
        queued:    taskStats.find((t) => t.status === "QUEUED")?._count     ?? 0,
      };

      return { agent, tasks, recentLogs, latestMemory, providerConfig, totalSpent };
    }),
  );

  // Summary row
  const totalCompleted = agentData.reduce((s, d) => s + d.tasks.completed, 0);
  const totalFailed    = agentData.reduce((s, d) => s + d.tasks.failed,    0);
  const totalRunning   = agentData.reduce((s, d) => s + d.tasks.running,   0);
  const activeErrors   = agents.filter((a) => a.status === "ERROR").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/hq" className="text-dark-500 hover:text-dark-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Activity size={20} className="text-[#c9a84c]" />
        <div>
          <h1 className="text-xl font-display text-white">Agent Reports</h1>
          <p className="text-dark-500 text-xs mt-0.5">Live per-agent status, tasks, logs, and AI provider health.</p>
        </div>
        <div className="ml-auto flex gap-3 text-xs text-dark-500">
          <span><span className="text-green-400 font-semibold">{totalCompleted}</span> done today</span>
          <span><span className="text-blue-400 font-semibold">{totalRunning}</span> running</span>
          <span><span className="text-red-400 font-semibold">{totalFailed}</span> failed</span>
          {activeErrors > 0 && <span className="text-red-400 font-semibold">{activeErrors} agents in ERROR</span>}
        </div>
      </div>

      {/* Per-agent cards */}
      <div className="space-y-6">
        {agentData.map(({ agent, tasks, recentLogs, latestMemory, providerConfig, totalSpent }) => (
          <div key={agent.id} className="bg-dark-900 border border-white/[0.07] rounded-2xl overflow-hidden">

            {/* Agent header */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.06]">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_COLOR[agent.status] ?? "bg-dark-600"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-white font-semibold capitalize">{agent.name}</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${agent.isEnabled ? "bg-green-500/10 text-green-400" : "bg-dark-800 text-dark-500"}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-dark-500 text-xs mt-0.5">{agent.description || "No description"}</p>
              </div>
              <div className="text-right text-xs text-dark-500 flex-shrink-0">
                <p>Last run: <span className="text-dark-300">{timeAgo(agent.lastRunAt)}</span></p>
                <p>{agent.totalRuns} total · {Math.round(agent.successRate)}% ok · avg {formatMs(agent.avgDurationMs)}</p>
              </div>
              <AgentRunButton agentName={agent.name} />
            </div>

            {/* Stats + provider row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-px bg-white/[0.05]">
              {[
                { label: "Completed today", value: tasks.completed, color: "text-green-400" },
                { label: "Failed today",    value: tasks.failed,    color: "text-red-400"   },
                { label: "Running",         value: tasks.running,   color: "text-blue-400"  },
                { label: "Queued",          value: tasks.queued,    color: "text-yellow-400" },
                { label: "Total tokens",    value: (totalSpent._sum.tokensUsed ?? 0).toLocaleString(), color: "text-dark-300" },
                { label: "AI cost",         value: `€${((totalSpent._sum.costCents ?? 0) / 100).toFixed(2)}`, color: "text-[#c9a84c]" },
              ].map((s) => (
                <div key={s.label} className="bg-dark-900 px-4 py-3">
                  <p className={`text-lg font-display ${s.color}`}>{s.value}</p>
                  <p className="text-dark-500 text-[10px] uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Provider + key health */}
            {providerConfig && (
              <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-3 flex-wrap">
                <Zap size={12} className="text-[#c9a84c]" />
                <span className="text-dark-500 text-xs">Primary provider:</span>
                <span className="text-white text-xs font-mono">{providerConfig.provider}</span>
                <span className="text-dark-500 text-xs">·</span>
                <span className="text-dark-400 text-xs font-mono">{providerConfig.model}</span>
                <span className="text-dark-500 text-xs">·</span>
                <KeyHealthBadge envKey={providerConfig.envKey} configured={providerConfig.configured} />
              </div>
            )}

            {/* Latest memory */}
            {latestMemory && (
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 mb-1">
                  <Database size={11} className="text-purple-400" />
                  <span className="text-[10px] text-dark-500 uppercase tracking-wider">Latest memory</span>
                  <span className="text-dark-500 text-[10px]">{timeAgo(latestMemory.createdAt)}</span>
                </div>
                <p className="text-white text-xs font-medium">{latestMemory.title}</p>
                <p className="text-dark-500 text-[11px] mt-0.5 line-clamp-2">{latestMemory.content.slice(0, 200)}</p>
              </div>
            )}

            {/* Activity log */}
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={11} className="text-dark-500" />
                <span className="text-[10px] text-dark-500 uppercase tracking-wider">Recent activity</span>
              </div>
              {recentLogs.length === 0 ? (
                <p className="text-dark-500 text-xs py-2">No activity yet. Run this agent to see logs.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {recentLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                      <span className="text-dark-500 flex-shrink-0 w-20 text-right">{timeAgo(log.createdAt)}</span>
                      <span className={`flex-shrink-0 w-24 ${LOG_LEVEL_COLOR[log.level ?? "info"] ?? "text-dark-400"}`}>{log.action}</span>
                      <span className="text-dark-400 truncate">{log.message}</span>
                      {log.durationMs ? <span className="text-dark-500 flex-shrink-0">{formatMs(log.durationMs)}</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error banner */}
            {agent.lastError && (
              <div className="px-5 py-3 bg-red-500/5 border-t border-red-500/20 flex items-start gap-2">
                <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs">{agent.lastError}</p>
              </div>
            )}
          </div>
        ))}

        {agentData.length === 0 && (
          <div className="text-center py-16 text-dark-500">
            <Bot size={32} className="mx-auto mb-3 opacity-30" />
            <p>No agents found. <Link href="/api/ai/seed" className="text-[#c9a84c] underline">Seed agents →</Link></p>
          </div>
        )}
      </div>

      {/* Key health panel */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={16} className="text-[#c9a84c]" />
          <h2 className="text-white text-sm font-semibold">API Key Pool Health</h2>
          <Link href="/admin/hq" className="ml-auto text-dark-500 text-xs hover:text-dark-300">← Back to HQ</Link>
        </div>
        <div className="bg-dark-900 border border-white/[0.07] rounded-xl p-4">
          <p className="text-dark-500 text-xs mb-3">
            Key health is tracked in-process (resets on cold start). Status updates automatically as providers are called.
            <Link href="/api/ai/keys" className="ml-2 text-[#c9a84c] underline" target="_blank">Raw JSON →</Link>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {providers.map((p) => (
              <div key={p.envKey} className="bg-dark-800 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${p.configured ? "bg-green-400" : "bg-dark-600"}`} />
                  <span className="text-white text-xs font-medium capitalize">{p.agent}</span>
                </div>
                <p className="text-dark-400 text-[10px] font-mono">{p.provider}</p>
                <p className="text-dark-500 text-[10px] font-mono truncate">{p.envKey}</p>
                {!p.configured && (
                  <p className="text-red-400 text-[10px] mt-0.5">⚠ Key not configured</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
