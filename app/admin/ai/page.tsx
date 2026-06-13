import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Bot, MessageCircle, Brain, Bell, DollarSign, FileText, Zap, Activity, Database, CheckCircle2, XCircle, Clock, Building2, Lightbulb } from "lucide-react";

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}

function timeAgo(d: Date | null) {
  if (!d) return "Never";
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Command Center | Admin", robots: { index: false } };

export default async function AiCommandCenterPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [agents, unreadAlerts, monthlyLogs, conversations, budgetConfig, kbCount, taskStats, memoryCount, recentTasks] = await Promise.all([
    prisma.aiAgent.findMany({ orderBy: { name: "asc" } }),
    prisma.aiAlert.count({ where: { isRead: false, isDismissed: false } }),
    prisma.aiLog.aggregate({ where: { createdAt: { gte: startOfMonth() } }, _sum: { costCents: true, tokensUsed: true } }),
    prisma.conversationLog.count({ where: { createdAt: { gte: since7d } } }),
    prisma.aiBudgetConfig.findFirst(),
    prisma.knowledgeBase.count({ where: { isActive: true } }),
    prisma.aiTask.groupBy({ by: ["status"], _count: true }),
    prisma.aiMemory.count(),
    prisma.aiTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { agent: { select: { name: true } } },
    }),
  ]);

  const spentCents  = monthlyLogs._sum.costCents ?? 0;
  const budgetCents = budgetConfig?.globalMonthlyBudgetCents ?? 2000;
  const budgetPct   = Math.min(Math.round((spentCents / budgetCents) * 100), 100);
  const killSwitch  = budgetConfig?.globalKillSwitch ?? false;

  const completedTasks = taskStats.find((t) => t.status === "COMPLETED")?._count ?? 0;
  const failedTasks    = taskStats.find((t) => t.status === "FAILED")?._count ?? 0;
  const totalTasks     = taskStats.reduce((s, t) => s + t._count, 0);

  const sections = [
    { href: "/admin/ai/agents",   icon: Bot,         label: "Agents",          badge: agents.filter(a => a.status === "ERROR").length || undefined, color: "text-blue-400",   desc: `${agents.filter(a => a.isEnabled).length} of ${agents.length} active` },
    { href: "/admin/ai/activity", icon: Activity,    label: "Live Activity",   badge: undefined, color: "text-green-400",  desc: "Real-time log feed" },
    { href: "/admin/ai/memory",   icon: Database,    label: "Agent Memory",    badge: memoryCount || undefined, color: "text-purple-400", desc: `${memoryCount} stored memories` },
    { href: "/admin/ai/support",  icon: MessageCircle, label: "Support Chat",  badge: conversations || undefined, color: "text-emerald-400", desc: `${conversations} chats (7d)` },
    { href: "/admin/ai/knowledge", icon: Brain,      label: "Knowledge Base",  badge: kbCount || undefined, color: "text-indigo-400", desc: `${kbCount} active entries` },
    { href: "/admin/ai/alerts",   icon: Bell,        label: "Alerts",          badge: unreadAlerts || undefined, color: "text-yellow-400", desc: `${unreadAlerts} unread` },
    { href: "/admin/ai/cost",     icon: DollarSign,  label: "Budget & Cost",   color: "text-[#c9a84c]",  desc: `€${(spentCents/100).toFixed(2)} this month` },
    { href: "/admin/ai/logs",     icon: FileText,    label: "All Logs",        color: "text-white/40",   desc: "Full log history" },
    { href: "/admin/hq/learning", icon: Lightbulb,   label: "Learning",        color: "text-[#c9a84c]",  desc: "Flags & proposals" },
  ];

  const STATUS_DOT: Record<string, string> = {
    RUNNING: "bg-blue-400 animate-pulse",
    ERROR:   "bg-red-400",
    WARNING: "bg-yellow-400",
    PAUSED:  "bg-dark-500",
    IDLE:    "bg-green-400",
    OFFLINE: "bg-dark-600",
  };

  const TASK_STATUS_STYLE: Record<string, string> = {
    COMPLETED: "text-green-400",
    FAILED:    "text-red-400",
    RUNNING:   "text-blue-400",
    QUEUED:    "text-yellow-400",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap size={24} className="text-[#c9a84c]" />
          <h1 className="text-2xl font-display text-white">AI Command Center</h1>
          {killSwitch && (
            <span className="ml-2 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-semibold tracking-wide">KILL SWITCH ON</span>
          )}
        </div>
        <p className="text-dark-400 text-sm">Élite BCN AI Ecosystem — real agents, real tasks, real results.</p>
      </div>

      {killSwitch && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ⚠ Global kill switch is ON — all AI agents are paused.
          <Link href="/admin/ai/cost" className="ml-2 underline">Manage budget →</Link>
        </div>
      )}

      {/* HQ Banner */}
      <Link
        href="/admin/hq"
        className="block mb-8 relative overflow-hidden rounded-xl border border-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-all group"
        style={{ background: "linear-gradient(135deg,rgba(201,168,76,0.08) 0%,rgba(201,168,76,0.03) 100%)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#c9a84c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-5 p-5">
          <div className="w-12 h-12 border border-[#c9a84c]/50 rotate-45 flex items-center justify-center flex-shrink-0">
            <div className="w-4 h-4 bg-[#c9a84c]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#c9a84c]/60 mb-0.5">Mission Control</p>
            <h2 className="text-white font-display tracking-wider text-lg">ÉLITE BCN AI HEADQUARTERS</h2>
            <p className="text-dark-400 text-xs mt-0.5">Live org chart · Agent floor · CEO suite · Communications wall</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[#c9a84c] text-xs tracking-wider">Enter HQ</span>
            <svg className="w-4 h-4 text-[#c9a84c] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Tasks",    value: totalTasks,      sub: "all time" },
          { label: "Completed",      value: completedTasks,  sub: `${totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0}% success rate` },
          { label: "Failed",         value: failedTasks,     sub: "errors recorded" },
          { label: "Agent Memory",   value: memoryCount,     sub: "stored findings" },
        ].map((s) => (
          <div key={s.label} className="bg-dark-900 border border-white/[0.07] rounded-xl p-4">
            <p className="text-2xl font-display text-white">{s.value}</p>
            <p className="text-dark-400 text-xs mt-0.5">{s.sub}</p>
            <p className="text-dark-500 text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      <div className="mb-8 bg-dark-900 border border-white/[0.07] rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <p className="text-white text-sm font-medium">Monthly AI Budget</p>
          <p className="text-dark-400 text-sm">€{(spentCents/100).toFixed(2)} / €{(budgetCents/100).toFixed(2)}</p>
        </div>
        <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-red-500" : budgetPct >= 80 ? "bg-yellow-500" : "bg-[#c9a84c]"}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <p className="text-dark-500 text-xs mt-2">{budgetPct}% used · {monthlyLogs._sum.tokensUsed?.toLocaleString() ?? 0} tokens · <Link href="/admin/ai/cost" className="underline hover:text-dark-300">manage →</Link></p>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {sections.map(({ href, icon: Icon, label, badge, color, desc }) => (
          <Link
            key={href}
            href={href}
            className="relative bg-dark-900 border border-white/[0.07] rounded-xl p-4 hover:border-[#c9a84c]/30 transition-colors group"
          >
            <Icon size={20} className={`${color} mb-2`} />
            <p className="text-white text-sm font-medium">{label}</p>
            <p className="text-dark-500 text-[10px] mt-0.5">{desc}</p>
            {badge !== undefined && badge > 0 && (
              <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent status */}
        <div className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-white text-sm font-semibold">Agent Status</h2>
            <Link href="/admin/ai/agents" className="text-dark-500 text-xs hover:text-dark-300">Manage →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[a.status] ?? "bg-dark-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm capitalize">{a.name}</p>
                  <p className="text-dark-600 text-[10px]">
                    {a.lastRunAt ? `Last run: ${timeAgo(a.lastRunAt)}` : "Never run"}
                    {a.totalRuns > 0 ? ` · ${a.totalRuns} runs · ${Math.round(a.successRate)}% ok` : ""}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.isEnabled ? "bg-green-500/10 text-green-400" : "bg-dark-800 text-dark-500"}`}>
                  {a.status}
                </span>
              </div>
            ))}
            {agents.length === 0 && (
              <div className="p-6 text-center text-dark-500 text-sm">
                No agents. <Link href="/api/ai/seed" className="text-[#c9a84c] underline">Seed →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent tasks */}
        <div className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-white text-sm font-semibold">Recent Tasks</h2>
            <Link href="/admin/ai/activity" className="text-dark-500 text-xs hover:text-dark-300">Live feed →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentTasks.length === 0 ? (
              <div className="p-6 text-center text-dark-500 text-sm">No tasks yet. Run an agent.</div>
            ) : recentTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                {t.status === "COMPLETED" ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                  : t.status === "FAILED"  ? <XCircle      size={13} className="text-red-400 flex-shrink-0" />
                  : <Clock size={13} className="text-yellow-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs capitalize">{t.agent?.name ?? "—"}</p>
                  <p className="text-dark-600 text-[10px]">
                    {t.durationMs ? `${(t.durationMs / 1000).toFixed(1)}s` : "—"}
                    {t.error ? ` · ${t.error.slice(0, 40)}…` : ""}
                  </p>
                </div>
                <span className={`text-[10px] flex-shrink-0 ${TASK_STATUS_STYLE[t.status] ?? "text-dark-500"}`}>
                  {t.status}
                </span>
                <span className="text-dark-600 text-[10px] flex-shrink-0 w-14 text-right">
                  {timeAgo(t.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
