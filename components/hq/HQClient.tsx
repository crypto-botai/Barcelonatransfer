"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { HQData, HQAgent, HQLog, HQTask } from "@/lib/ai/hqData";
import EcosystemMap from "./EcosystemMap";
import AgentOffice from "./AgentOffice";

/* ── Org node definitions ────────────────────────────────────────────────── */
export interface OrgNode {
  id: string;
  agentKey: string | null;
  title: string;
  shortTitle: string;
  icon: string;
  color: string;
  dept: string;
  level: 0 | 1 | 2;
  cx: number; cy: number; w: number; h: number;
  parentId: string | null;
  responsibilities: string[];
}

export const ORG_NODES: OrgNode[] = [
  { id:"ceo",       agentKey:"orchestrator", title:"AI Chief Executive Officer", shortTitle:"AI CEO",         icon:"👑", color:"#c9a84c", dept:"Executive",       level:0, cx:600, cy:30,  w:180, h:85, parentId:null,      responsibilities:["Oversees entire AI ecosystem","Reviews all agent performance","Generates executive reports","Assigns task priorities","Coordinates all departments"] },
  { id:"ops_mgr",   agentKey:null,           title:"Operations Manager",          shortTitle:"Ops Manager",   icon:"⚙️", color:"#3b82f6", dept:"Operations",      level:1, cx:150, cy:200, w:148, h:75, parentId:"ceo",     responsibilities:["Oversees bookings & drivers","Manages operational workflows","Monitors service delivery","Coordinates logistics"] },
  { id:"mkt_mgr",   agentKey:null,           title:"Marketing Manager",           shortTitle:"Mkt Manager",   icon:"📈", color:"#8b5cf6", dept:"Marketing",       level:1, cx:450, cy:200, w:148, h:75, parentId:"ceo",     responsibilities:["SEO strategy oversight","Content planning","Competitor monitoring","Traffic growth targets"] },
  { id:"cs_mgr",    agentKey:null,           title:"Customer Success Mgr",        shortTitle:"CS Manager",    icon:"💎", color:"#10b981", dept:"Customer Success",level:1, cx:750, cy:200, w:148, h:75, parentId:"ceo",     responsibilities:["Customer satisfaction","Support quality assurance","Review management","Escalation handling"] },
  { id:"rev_mgr",   agentKey:null,           title:"Revenue Manager",             shortTitle:"Rev Manager",   icon:"💰", color:"#f59e0b", dept:"Revenue",         level:1, cx:1050,cy:200, w:148, h:75, parentId:"ceo",     responsibilities:["Revenue tracking","Conversion optimization","Pricing analysis","KPI monitoring"] },
  { id:"booking",   agentKey:"booking",      title:"Booking Intelligence",        shortTitle:"Booking Agent", icon:"📋", color:"#3b82f6", dept:"Operations",      level:2, cx:75,  cy:380, w:130, h:70, parentId:"ops_mgr", responsibilities:["Monitor new bookings","Validate booking forms","Score & prioritize leads","Detect missing information"] },
  { id:"health",    agentKey:"health",       title:"Website Health Agent",        shortTitle:"Health Agent",  icon:"🔍", color:"#3b82f6", dept:"Operations",      level:2, cx:225, cy:380, w:130, h:70, parentId:"ops_mgr", responsibilities:["Monitor site uptime","Check page performance","Detect broken links","Form validation checks"] },
  { id:"seo",       agentKey:"seo",          title:"SEO Intelligence Agent",      shortTitle:"SEO Agent",     icon:"🔎", color:"#8b5cf6", dept:"Marketing",       level:2, cx:375, cy:380, w:130, h:70, parentId:"mkt_mgr", responsibilities:["Scan pages for SEO issues","Meta tag optimization","Schema validation","Keyword opportunity tracking"] },
  { id:"marketing", agentKey:"marketing",    title:"Marketing Creative",          shortTitle:"Creative Agent",icon:"✨", color:"#8b5cf6", dept:"Marketing",       level:2, cx:525, cy:380, w:130, h:70, parentId:"mkt_mgr", responsibilities:["Generate content ideas","Campaign planning","Blog topic generation","Social media strategy"] },
  { id:"support",   agentKey:"support",      title:"Support Concierge",           shortTitle:"Support Agent", icon:"💬", color:"#10b981", dept:"Customer Success",level:2, cx:675, cy:380, w:130, h:70, parentId:"cs_mgr",  responsibilities:["Handle AI chat sessions","Answer visitor FAQs","Escalate complex issues","Monitor satisfaction"] },
  { id:"review",    agentKey:"review",       title:"Review Monitor Agent",        shortTitle:"Review Agent",  icon:"⭐", color:"#10b981", dept:"Customer Success",level:2, cx:825, cy:380, w:130, h:70, parentId:"cs_mgr",  responsibilities:["Monitor new reviews","Sentiment analysis","Suggest response templates","Track rating trends"] },
  { id:"analytics", agentKey:"analytics",    title:"Analytics Engine",            shortTitle:"Analytics",     icon:"📊", color:"#f59e0b", dept:"Revenue",         level:2, cx:975, cy:380, w:130, h:70, parentId:"rev_mgr", responsibilities:["Traffic analysis","Conversion tracking","Performance reporting","Funnel optimization"] },
  { id:"knowledge", agentKey:"knowledge",    title:"Knowledge Manager",           shortTitle:"Knowledge",     icon:"🧠", color:"#f59e0b", dept:"Revenue",         level:2, cx:1125,cy:380, w:130, h:70, parentId:"rev_mgr", responsibilities:["Manage knowledge base","Update outdated info","Improve AI retrieval","Content accuracy checks"] },
  // ── Shared Spaces — not agents, but part of the HQ ecosystem ──────────────
  { id:"meeting",   agentKey:null,           title:"Meeting Room — Daily Standup Space",   shortTitle:"Meeting Room", icon:"🗂️", color:"#94a3b8", dept:"Shared Spaces", level:2, cx:420, cy:490, w:160, h:70, parentId:null, responsibilities:["Daily team standups","Cross-agent coordination","Strategy reviews","Agent briefings"] },
  { id:"cafe",      agentKey:null,           title:"Café & Bar — Agent Break Space",        shortTitle:"Café / Bar",   icon:"☕", color:"#f97316", dept:"Shared Spaces", level:2, cx:620, cy:490, w:160, h:70, parentId:null, responsibilities:["Agent rest & recovery","Informal knowledge sharing","Creative thinking","Morale support"] },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
export function findAgent(agents: HQAgent[], key: string | null): HQAgent | undefined {
  if (!key) return undefined;
  return agents.find(a => a.name === key);
}

export function statusColor(status: string): string {
  return status === "RUNNING" ? "#facc15"
       : status === "ERROR"   ? "#ef4444"
       : status === "PAUSED"  ? "#6b7280"
       : status === "IDLE"    ? "#22c55e"
       : "#374151";
}

function timeAgo(d: Date | string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Main HQ Client ──────────────────────────────────────────────────────── */
type View = "map" | "agents" | "activity" | "ceo" | "comms";

export default function HQClient({ initialData }: { initialData: HQData }) {
  const [data, setData]               = useState<HQData>(initialData);
  const [view, setView]               = useState<View>("map");
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [tick, setTick]               = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/ai/hq");
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    const iv = setInterval(() => { refresh(); setTick(t => t + 1); }, 15000);
    return () => clearInterval(iv);
  }, [refresh]);

  const { agents, recentTasks, recentLogs, activeAlerts, metrics } = data;
  const now = new Date();

  return (
    <div className="min-h-screen bg-[#030305] text-white relative overflow-hidden">
      <style>{`
        @keyframes hqPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.4)} }
        @keyframes hqFlow  { to { stroke-dashoffset: 0; } }
        @keyframes hqGlow  { 0%,100%{box-shadow:0 0 8px 2px rgba(201,168,76,.2)} 50%{box-shadow:0 0 20px 6px rgba(201,168,76,.5)} }
        @keyframes hqSlide { from{transform:translateX(100%)} to{transform:translateX(0)} }
        @keyframes hqFadeUp{ from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hqScan  { 0%{top:-4px;opacity:0} 20%{opacity:1} 80%{opacity:1} 100%{top:100%;opacity:0} }
        .hq-pulse { animation: hqPulse 2s ease-in-out infinite; }
        .hq-glow  { animation: hqGlow  3s ease-in-out infinite; }
        .hq-fade  { animation: hqFadeUp .4s ease forwards; }
        .hq-grid  { background-image: radial-gradient(circle at 1px 1px,rgba(201,168,76,.05) 1px,transparent 0); background-size:40px 40px; }
        .hq-card  { background:rgba(8,8,16,.85); border:1px solid rgba(255,255,255,.07); backdrop-filter:blur(12px); }
        .hq-card:hover { border-color:rgba(201,168,76,.25); }
        .hq-tab-active { background:rgba(201,168,76,.1); border-color:rgba(201,168,76,.4)!important; color:#c9a84c!important; }
      `}</style>

      {/* Grid background */}
      <div className="hq-grid fixed inset-0 pointer-events-none" />

      {/* Top ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-[#c9a84c]/5 blur-[100px] pointer-events-none" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative border-b border-white/[0.06] bg-[#030305]/90 backdrop-blur sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center hq-glow">
                  <div className="w-3 h-3 bg-[#c9a84c]" />
                </div>
                <div>
                  <h1 className="font-display text-lg tracking-[0.25em] text-white uppercase">
                    Élite BCN <span className="text-[#c9a84c]">AI Headquarters</span>
                  </h1>
                  <p className="text-white/30 text-[10px] tracking-[0.3em] uppercase mt-0.5">
                    Mission Control · {now.toLocaleString("en-GB", { weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Live KPI strip */}
            <div className="hidden sm:flex items-center gap-4 text-right">
              {[
                { label:"Agents Active",  val: `${metrics.agentsRunning}/${metrics.agentCount}`, color: metrics.agentsRunning > 0 ? "#22c55e" : "#6b7280" },
                { label:"Tasks Today",    val: `${metrics.totalToday}`,    color:"#c9a84c" },
                { label:"Success Rate",   val: `${metrics.avgSuccess}%`,   color: metrics.avgSuccess >= 80 ? "#22c55e" : "#ef4444" },
                { label:"Bookings Today", val: `${metrics.bookingsToday}`, color:"#3b82f6" },
                { label:"Revenue Today",  val: `€${metrics.revenueToday.toFixed(0)}`, color:"#c9a84c" },
                { label:"Alerts",         val: `${metrics.alertCount}`,    color: metrics.alertCount > 0 ? "#ef4444" : "#22c55e" },
              ].map(k => (
                <div key={k.label} className="text-right">
                  <div className="text-sm font-mono font-bold" style={{ color: k.color }}>{k.val}</div>
                  <div className="text-[9px] text-white/30 uppercase tracking-wider">{k.label}</div>
                </div>
              ))}
              {/* Live indicator */}
              <div className="flex items-center gap-1.5 pl-4 border-l border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] hq-pulse" />
                <span className="text-[9px] text-white/40 uppercase tracking-widest">Live</span>
              </div>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex gap-1.5 mt-4 overflow-x-auto">
            {([
              { v:"map",      label:"🗺  Ecosystem Map" },
              { v:"agents",   label:"🤖 Agent Floor" },
              { v:"activity", label:"⚡ Activity Feed" },
              { v:"ceo",      label:"👑 CEO Suite" },
              { v:"comms",    label:"💬 Comms Wall" },
            ] as { v: View; label: string }[]).map(({ v, label }) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg border text-xs font-medium tracking-wider uppercase whitespace-nowrap transition-all border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 ${view === v ? "hq-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="relative">
        {view === "map" && (
          <EcosystemMap agents={agents} onSelect={setSelectedNode} />
        )}
        {view === "agents" && (
          <AgentFloor agents={agents} nodes={ORG_NODES} onSelect={setSelectedNode} />
        )}
        {view === "activity" && (
          <ActivityFeed tasks={recentTasks} logs={recentLogs} />
        )}
        {view === "ceo" && (
          <CEOSuite metrics={metrics} agents={agents} alerts={activeAlerts} tasks={recentTasks} logs={recentLogs} />
        )}
        {view === "comms" && (
          <CommsWall logs={recentLogs} tasks={recentTasks} agents={agents} />
        )}
      </main>

      {/* ── Agent Office drawer ─────────────────────────────────────────────── */}
      {selectedNode && (
        <AgentOffice
          node={selectedNode}
          agent={findAgent(agents, selectedNode.agentKey)}
          allTasks={recentTasks}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT FLOOR VIEW
═══════════════════════════════════════════════════════════════════════════ */
function AgentFloor({ agents, nodes, onSelect }: {
  agents: HQAgent[];
  nodes: OrgNode[];
  onSelect: (n: OrgNode) => void;
}) {
  const depts: Record<string, { color: string; nodes: OrgNode[] }> = {};
  for (const n of nodes) {
    if (!depts[n.dept]) depts[n.dept] = { color: n.color, nodes: [] };
    depts[n.dept].nodes.push(n);
  }

  return (
    <div className="p-6 space-y-8">
      {Object.entries(depts).map(([dept, { color, nodes: dNodes }]) => (
        <div key={dept}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 opacity-20" style={{ background: color }} />
            <span className="text-xs font-mono tracking-[0.3em] uppercase px-3" style={{ color }}>
              {dept} Department
            </span>
            <div className="h-px flex-1 opacity-20" style={{ background: color }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dNodes.map(n => {
              const agent = findAgent(agents, n.agentKey);
              return (
                <AgentCard key={n.id} node={n} agent={agent} onClick={() => onSelect(n)} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Individual agent card ────────────────────────────────────────────────── */
function AgentCard({ node, agent, onClick }: { node: OrgNode; agent?: HQAgent; onClick: () => void }) {
  const status   = agent?.status ?? "NOT_DEPLOYED";
  const sColor   = statusColor(status);
  const deployed = !!agent;
  const total    = (agent?.tasksToday.completed ?? 0) + (agent?.tasksToday.failed ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="hq-card rounded-xl p-5 text-left w-full transition-all hover:scale-[1.01] group relative overflow-hidden"
      style={{ borderTopColor: node.color, borderTopWidth: 2 }}
    >
      {/* Scan line on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none overflow-hidden rounded-xl">
        <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#c9a84c]/30 to-transparent" style={{ animation: "hqScan 2s linear infinite" }} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{node.icon}</span>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: node.color }}>{node.dept}</p>
            <p className="text-white text-sm font-semibold leading-tight">{node.shortTitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "RUNNING" ? "hq-pulse" : ""}`}
              style={{ background: sColor }}
            />
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: sColor }}>
              {status === "NOT_DEPLOYED" ? "offline" : status.toLowerCase()}
            </span>
          </div>
          {node.level === 1 && (
            <span className="text-[8px] text-white/20 uppercase tracking-wider">virtual</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-white/40 text-[11px] leading-relaxed line-clamp-2 mb-4">{node.title}</p>

      {/* Metrics grid */}
      {deployed && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label:"Success", val:`${Math.round(agent!.successRate)}%`, color: agent!.successRate >= 80 ? "#22c55e" : "#f59e0b" },
            { label:"Today",   val:`${total}`,                           color:"#c9a84c" },
            { label:"Memory",  val:`${agent!.memoryCount}`,              color:"#8b5cf6" },
          ].map(m => (
            <div key={m.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
              <div className="text-sm font-mono font-bold" style={{ color: m.color }}>{m.val}</div>
              <div className="text-[8px] text-white/20 uppercase tracking-wider mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {!deployed && (
        <div className="flex items-center gap-2 py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.05] mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span className="text-[10px] text-white/20">Agent not deployed</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
        <span className="text-[9px] text-white/20">{agent?.lastRunAt ? `Last: ${timeAgo(agent.lastRunAt)}` : "Never run"}</span>
        <span className="text-[9px] text-white/20 flex items-center gap-1">
          {agent?.totalRuns ?? 0} total runs
          <svg className="w-3 h-3 text-white/20 group-hover:text-[#c9a84c] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY FEED VIEW
═══════════════════════════════════════════════════════════════════════════ */
function ActivityFeed({ tasks, logs }: { tasks: HQTask[]; logs: HQLog[] }) {
  type Entry = { id: string; time: Date; agentName: string; title: string; sub: string; type: "task" | "log"; status?: string; level?: string };

  const entries: Entry[] = [
    ...tasks.map(t => ({
      id: `t-${t.id}`, time: new Date(t.createdAt),
      agentName: t.agent?.name ?? "Unknown",
      title: `Task ${t.status.toLowerCase()}`,
      sub: t.error ? t.error.slice(0, 80) : t.durationMs ? `Completed in ${(t.durationMs/1000).toFixed(1)}s` : "Running…",
      type: "task" as const, status: t.status,
    })),
    ...logs.slice(0, 40).map(l => ({
      id: `l-${l.id}`, time: new Date(l.createdAt),
      agentName: l.agent?.name ?? "System",
      title: l.action.replace(/_/g, " "),
      sub: l.message.slice(0, 100),
      type: "log" as const, level: l.level,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 60);

  const dot = (e: Entry) => {
    if (e.type === "task") {
      if (e.status === "COMPLETED") return "#22c55e";
      if (e.status === "FAILED")    return "#ef4444";
      if (e.status === "RUNNING")   return "#facc15";
      return "#6b7280";
    }
    if (e.level === "error")   return "#ef4444";
    if (e.level === "warn")    return "#f59e0b";
    return "#3b82f6";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] hq-pulse" />
        <span className="text-white/40 text-xs tracking-widest uppercase">Live Activity — refreshes every 15s</span>
      </div>
      <div className="space-y-0 relative">
        {/* Timeline spine */}
        <div className="absolute left-[7px] top-4 bottom-4 w-[1px] bg-gradient-to-b from-[#c9a84c]/20 via-white/5 to-transparent" />
        {entries.map((e, i) => (
          <div key={e.id} className="flex gap-4 pb-4 hq-fade" style={{ animationDelay: `${i * 20}ms` }}>
            <div className="relative flex-shrink-0 pt-1">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 border-[#030305] z-10 relative ${e.status === "RUNNING" || e.level === "info" ? "hq-pulse" : ""}`}
                style={{ background: dot(e) }}
              />
            </div>
            <div className="flex-1 min-w-0 hq-card rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#c9a84c] text-xs font-mono capitalize">{e.agentName}</span>
                    <span className="text-white/60 text-xs capitalize">{e.title}</span>
                  </div>
                  <p className="text-white/30 text-[11px] mt-0.5 line-clamp-2">{e.sub}</p>
                </div>
                <span className="text-white/20 text-[9px] whitespace-nowrap flex-shrink-0 font-mono">
                  {new Date(e.time).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-20 text-white/20 text-sm">No activity yet. Run some agents.</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CEO SUITE VIEW
═══════════════════════════════════════════════════════════════════════════ */
function CEOSuite({ metrics, agents, alerts, tasks, logs }: {
  metrics: HQData["metrics"];
  agents: HQAgent[];
  alerts: HQData["activeAlerts"];
  tasks: HQTask[];
  logs: HQLog[];
}) {
  const kpis = [
    { label:"Bookings Today",   val: metrics.bookingsToday,              unit:"",    color:"#3b82f6",  icon:"📅" },
    { label:"Revenue Today",    val: `€${metrics.revenueToday.toFixed(0)}`, unit:"", color:"#c9a84c",  icon:"💰" },
    { label:"Tasks Completed",  val: metrics.completedToday,             unit:"",    color:"#22c55e",  icon:"✅" },
    { label:"Tasks Failed",     val: metrics.failedToday,                unit:"",    color: metrics.failedToday > 0 ? "#ef4444" : "#22c55e", icon:"⚠️" },
    { label:"Agent Success Rate", val:`${metrics.avgSuccess}%`,          unit:"",    color: metrics.avgSuccess >= 80 ? "#22c55e" : "#f59e0b", icon:"📈" },
    { label:"AI Chats (7d)",    val: metrics.conversations7d,            unit:"",    color:"#8b5cf6",  icon:"💬" },
    { label:"KB Articles",      val: metrics.kbCount,                    unit:"",    color:"#10b981",  icon:"🧠" },
    { label:"Open Alerts",      val: metrics.alertCount,                 unit:"",    color: metrics.alertCount > 0 ? "#ef4444" : "#22c55e", icon:"🔔" },
  ];

  const topAgents = [...agents].sort((a, b) => b.successRate - a.successRate).slice(0, 5);
  const errorAgents = agents.filter(a => a.status === "ERROR");
  const recentErrors = tasks.filter(t => t.status === "FAILED").slice(0, 5);

  return (
    <div className="p-6 space-y-8">
      {/* Title */}
      <div className="flex items-center gap-4">
        <span className="text-4xl">👑</span>
        <div>
          <h2 className="font-display text-2xl tracking-wide text-[#c9a84c]">Executive Command Center</h2>
          <p className="text-white/30 text-sm mt-0.5">Real-time overview for the AI CEO — all business & AI metrics</p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="hq-card rounded-xl p-4 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: k.color }} />
            <div className="text-2xl mb-2">{k.icon}</div>
            <div className="text-2xl font-mono font-bold" style={{ color: k.color }}>{k.val}</div>
            <div className="text-[10px] text-white/30 uppercase tracking-wider mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      <div className="hq-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/60 text-sm">Monthly AI Budget</span>
          <span className="text-white/40 text-sm font-mono">€{(metrics.spentCents/100).toFixed(2)} / €{(metrics.budgetCents/100).toFixed(2)}</span>
        </div>
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${metrics.budgetPct}%`,
              background: metrics.budgetPct >= 90 ? "#ef4444" : metrics.budgetPct >= 70 ? "#f59e0b" : "#c9a84c",
            }}
          />
        </div>
        <p className="text-white/20 text-[10px] mt-1.5">{metrics.budgetPct}% consumed this month</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent performance */}
        <div className="hq-card rounded-xl p-5">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-[#22c55e]">●</span> Top Agents by Success Rate
          </h3>
          <div className="space-y-3">
            {topAgents.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-white/20 text-[10px] w-4">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/70 text-xs capitalize">{a.name}</span>
                    <span className="text-[#22c55e] text-xs font-mono">{Math.round(a.successRate)}%</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#22c55e]/60" style={{ width: `${a.successRate}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {topAgents.length === 0 && <p className="text-white/20 text-xs">No agent data yet</p>}
          </div>
        </div>

        {/* Active alerts */}
        <div className="hq-card rounded-xl p-5">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-[#ef4444]">●</span> Active Alerts
          </h3>
          <div className="space-y-3">
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.severity === "CRITICAL" ? "bg-[#ef4444] hq-pulse" : a.severity === "WARNING" ? "bg-[#f59e0b]" : "bg-[#3b82f6]"}`} />
                <div>
                  <p className="text-white/70 text-xs leading-tight">{a.title}</p>
                  <p className="text-white/25 text-[10px] mt-0.5 line-clamp-2">{a.message}</p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="flex items-center gap-2 text-[#22c55e] text-xs">
                <span>✓</span> All systems nominal
              </div>
            )}
          </div>
          <Link href="/admin/ai/alerts" className="mt-4 text-[9px] text-white/20 hover:text-white/40 transition-colors block">
            View all alerts →
          </Link>
        </div>

        {/* Recent failures */}
        <div className="hq-card rounded-xl p-5">
          <h3 className="text-white/60 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="text-[#ef4444]">●</span> Recent Task Failures
          </h3>
          <div className="space-y-3">
            {recentErrors.map(t => (
              <div key={t.id} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-xs capitalize">{t.agent?.name ?? "Unknown"}</p>
                  <p className="text-white/25 text-[10px] line-clamp-2">{t.error ?? "Unknown error"}</p>
                  <p className="text-white/15 text-[9px] font-mono mt-0.5">{timeAgo(t.createdAt)}</p>
                </div>
              </div>
            ))}
            {recentErrors.length === 0 && (
              <div className="flex items-center gap-2 text-[#22c55e] text-xs">
                <span>✓</span> No recent failures
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error agents */}
      {errorAgents.length > 0 && (
        <div className="hq-card rounded-xl p-5 border-l-4 border-[#ef4444]">
          <h3 className="text-[#ef4444] text-xs uppercase tracking-widest mb-3">⚠ Agents Requiring Attention</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {errorAgents.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 bg-red-500/5 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-[#ef4444] hq-pulse mt-1" />
                <div>
                  <p className="text-white/80 text-sm capitalize">{a.name}</p>
                  {a.lastError && <p className="text-white/30 text-[10px] mt-0.5 line-clamp-2">{a.lastError}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="hq-card rounded-xl p-5">
        <h3 className="text-[#c9a84c] text-xs uppercase tracking-widest mb-4">🎯 Executive Recommendations</h3>
        <div className="space-y-3">
          {[
            metrics.failedToday > 2 && { text: `${metrics.failedToday} task failures today — review agent error logs`, link: "/admin/ai/logs", severity: "warn" },
            metrics.alertCount > 0 && { text: `${metrics.alertCount} unread alerts require attention`, link: "/admin/ai/alerts", severity: "warn" },
            metrics.agentsRunning === 0 && { text: "No agents currently running — consider scheduling a cron run", link: "/admin/ai/agents", severity: "info" },
            metrics.avgSuccess < 70 && { text: `Agent success rate at ${metrics.avgSuccess}% — below recommended 70% threshold`, link: "/admin/ai/agents", severity: "warn" },
            metrics.bookingsToday === 0 && { text: "No bookings today — check marketing agents and SEO performance", link: "/admin/ai/agents", severity: "info" },
            { text: "Review AI memory for recent insights and findings", link: "/admin/ai/memory", severity: "tip" },
          ].filter(Boolean).map((rec, i) => rec && (
            <Link key={i} href={rec.link} className="flex items-start gap-3 hover:bg-white/[0.02] rounded-lg p-2 -mx-2 transition-colors group">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${rec.severity === "warn" ? "bg-[#f59e0b]" : "bg-[#3b82f6]"}`} />
              <p className="text-white/50 text-xs group-hover:text-white/70 transition-colors">{rec.text}</p>
              <svg className="w-3 h-3 text-white/20 group-hover:text-white/40 flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMUNICATIONS WALL
═══════════════════════════════════════════════════════════════════════════ */
function CommsWall({ logs, tasks, agents }: { logs: HQLog[]; tasks: HQTask[]; agents: HQAgent[] }) {
  type Msg = { id: string; from: string; color: string; text: string; time: Date; type: "agent" | "alert" | "system" };

  const msgs: Msg[] = [
    ...logs.slice(0, 30).map(l => ({
      id: `l-${l.id}`,
      from: l.agent?.name ?? "System",
      color: l.level === "error" ? "#ef4444" : l.level === "warn" ? "#f59e0b" : "#3b82f6",
      text: `[${l.action}] ${l.message}`,
      time: new Date(l.createdAt),
      type: "agent" as const,
    })),
    ...tasks.filter(t => t.status === "COMPLETED" || t.status === "FAILED").slice(0, 15).map(t => ({
      id: `t-${t.id}`,
      from: t.agent?.name ?? "Agent",
      color: t.status === "COMPLETED" ? "#22c55e" : "#ef4444",
      text: t.status === "COMPLETED"
        ? `Task completed${t.durationMs ? ` in ${(t.durationMs/1000).toFixed(1)}s` : ""}`
        : `Task failed: ${(t.error ?? "Unknown error").slice(0, 80)}`,
      time: new Date(t.createdAt),
      type: "agent" as const,
    })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 40);

  // Format agent name for display
  const agentColor = (name: string) => {
    const n = ORG_NODES.find(x => x.agentKey === name);
    return n?.color ?? "#c9a84c";
  };

  const depts: Record<string, string> = {};
  for (const n of ORG_NODES) if (n.agentKey) depts[n.agentKey] = n.dept;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[#c9a84c]">💬</span>
        <h2 className="text-white/60 text-xs uppercase tracking-widest">AI Internal Communications</h2>
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-white/20 text-[10px] font-mono">{msgs.length} messages</span>
      </div>

      <div className="space-y-3">
        {msgs.map((m, i) => {
          const color = agentColor(m.from);
          return (
            <div key={m.id} className="flex gap-3 hq-fade" style={{ animationDelay: `${i * 15}ms` }}>
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold uppercase"
                style={{ background: color + "22", color, border: `1px solid ${color}44` }}
              >
                {m.from.slice(0, 2)}
              </div>
              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs font-semibold capitalize" style={{ color }}>{m.from}</span>
                  {depts[m.from] && <span className="text-[9px] text-white/20 uppercase tracking-wider">{depts[m.from]}</span>}
                  <span className="text-[9px] text-white/15 font-mono ml-auto">
                    {new Date(m.time).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
                <div className="hq-card rounded-lg px-4 py-2.5 text-white/60 text-[11px] leading-relaxed">
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && (
          <div className="text-center py-20 text-white/20 text-sm">
            No agent communications yet. Run agents to see activity.
          </div>
        )}
      </div>
    </div>
  );
}
