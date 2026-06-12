import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Bot, MessageCircle, BookOpen, Bell, DollarSign, FileText, Zap, Brain } from "lucide-react";

function startOfMonth() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Command Center | Admin", robots: { index: false } };

export default async function AiCommandCenterPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  const [agents, unreadAlerts, monthlyLogs, conversations, budgetConfig, kbCount] = await Promise.all([
    prisma.aiAgent.findMany({ orderBy: { name: "asc" } }),
    prisma.aiAlert.count({ where: { isRead: false, isDismissed: false } }),
    prisma.aiLog.aggregate({ where: { createdAt: { gte: startOfMonth() } }, _sum: { costCents: true, tokensUsed: true } }),
    prisma.conversationLog.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.aiBudgetConfig.findFirst(),
    prisma.knowledgeBase.count({ where: { isActive: true } }),
  ]);

  const spentCents  = monthlyLogs._sum.costCents ?? 0;
  const budgetCents = budgetConfig?.globalMonthlyBudgetCents ?? 2000;
  const budgetPct   = Math.min(Math.round((spentCents / budgetCents) * 100), 100);
  const killSwitch  = budgetConfig?.globalKillSwitch ?? false;

  const sections = [
    { href: "/admin/ai/agents",   icon: Bot,         label: "Agents",          badge: agents.filter(a => a.status === "ERROR").length || undefined, color: "text-blue-400" },
    { href: "/admin/ai/support",  icon: MessageCircle, label: "Support Chat",  badge: conversations || undefined, color: "text-green-400" },
    { href: "/admin/ai/knowledge", icon: Brain,       label: "Knowledge Base", badge: kbCount || undefined, color: "text-purple-400" },
    { href: "/admin/ai/alerts",   icon: Bell,         label: "Alerts",         badge: unreadAlerts || undefined, color: "text-yellow-400" },
    { href: "/admin/ai/cost",     icon: DollarSign,   label: "Budget & Cost",  color: "text-gold-400" },
    { href: "/admin/ai/logs",     icon: FileText,     label: "Logs",           color: "text-white/50" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap size={24} className="text-[#c9a84c]" />
          <h1 className="text-2xl font-display text-white">AI Command Center</h1>
          {killSwitch && (
            <span className="ml-2 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-semibold tracking-wide">KILL SWITCH ON</span>
          )}
        </div>
        <p className="text-dark-400 text-sm">Élite BCN AI Ecosystem — all agents, conversations, and costs in one place.</p>
      </div>

      {/* Kill switch warning */}
      {killSwitch && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ⚠️ Global kill switch is ON — all AI agents are paused.
          <Link href="/admin/ai/cost" className="ml-2 underline">Manage budget →</Link>
        </div>
      )}

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Agents",        value: agents.length,                                  sub: `${agents.filter(a => a.isEnabled).length} enabled` },
          { label: "Alerts",        value: unreadAlerts,                                   sub: "unread" },
          { label: "Chat (7d)",     value: conversations,                                  sub: "conversations" },
          { label: "KB Entries",    value: kbCount,                                        sub: "active entries" },
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
        <p className="text-dark-500 text-xs mt-2">{budgetPct}% used this month · {monthlyLogs._sum.tokensUsed?.toLocaleString() ?? 0} tokens</p>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {sections.map(({ href, icon: Icon, label, badge, color }) => (
          <Link
            key={href}
            href={href}
            className="relative bg-dark-900 border border-white/[0.07] rounded-xl p-5 hover:border-[#c9a84c]/30 transition-colors group"
          >
            <Icon size={22} className={`${color} mb-3`} />
            <p className="text-white text-sm font-medium">{label}</p>
            {badge !== undefined && badge > 0 && (
              <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Agent status table */}
      <div className="mt-8 bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-white text-sm font-semibold">Agent Status</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {agents.map((a) => {
            const statusColor = a.status === "RUNNING" ? "bg-blue-400" : a.status === "ERROR" ? "bg-red-400" : a.status === "PAUSED" ? "bg-yellow-400" : a.status === "IDLE" ? "bg-green-400" : "bg-dark-600";
            return (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                <span className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm capitalize">{a.name}</p>
                  <p className="text-dark-500 text-xs truncate">{a.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-dark-400 text-xs">{a.status}</p>
                  <p className="text-dark-600 text-xs">{a.totalRuns} runs</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${a.isEnabled ? "bg-green-500/10 text-green-400" : "bg-dark-800 text-dark-500"}`}>
                  {a.isEnabled ? "ON" : "OFF"}
                </span>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div className="p-8 text-center text-dark-500 text-sm">
              No agents yet. <Link href="/api/ai/seed" className="text-gold-400 underline">Run seed →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
