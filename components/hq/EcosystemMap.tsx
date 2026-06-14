"use client";

import { useState } from "react";
import type { HQAgent } from "@/lib/ai/hqData";
import { ORG_NODES, OrgNode, findAgent, statusColor } from "./HQClient";

const MAP_W = 1200;
const MAP_H = 590;

/* ── Connection path definitions ─────────────────────────────────────────── */
// CEO bottom → manager tops
const CEO_CX = 600, CEO_BOTTOM = 30 + 85;    // 115
const MGR_TOP = 200;
const MGR_BOTTOM = 200 + 75;                  // 275
const WRK_TOP = 380;
const CTRL_CEO_MGR = (CEO_BOTTOM + MGR_TOP) / 2;  // 157
const CTRL_MGR_WRK = (MGR_BOTTOM + WRK_TOP) / 2;  // 327

function bezier(x1: number, y1: number, x2: number, y2: number, cy: number) {
  return `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`;
}

const CONNECTIONS: { id: string; d: string; isHighLevel: boolean }[] = [
  // CEO → Managers
  { id: "ceo-ops", d: bezier(CEO_CX, CEO_BOTTOM, 150,  MGR_TOP, CTRL_CEO_MGR), isHighLevel: true },
  { id: "ceo-mkt", d: bezier(CEO_CX, CEO_BOTTOM, 450,  MGR_TOP, CTRL_CEO_MGR), isHighLevel: true },
  { id: "ceo-cs",  d: bezier(CEO_CX, CEO_BOTTOM, 750,  MGR_TOP, CTRL_CEO_MGR), isHighLevel: true },
  { id: "ceo-rev", d: bezier(CEO_CX, CEO_BOTTOM, 1050, MGR_TOP, CTRL_CEO_MGR), isHighLevel: true },
  // Ops → workers
  { id: "ops-booking", d: bezier(150, MGR_BOTTOM, 75,  WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  { id: "ops-health",  d: bezier(150, MGR_BOTTOM, 225, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  // Mkt → workers
  { id: "mkt-seo",     d: bezier(450, MGR_BOTTOM, 375, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  { id: "mkt-mktcr",  d: bezier(450, MGR_BOTTOM, 525, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  // CS → workers
  { id: "cs-support",  d: bezier(750, MGR_BOTTOM, 675, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  { id: "cs-review",   d: bezier(750, MGR_BOTTOM, 825, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  // Rev → workers
  { id: "rev-ana",     d: bezier(1050, MGR_BOTTOM, 975,  WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
  { id: "rev-know",    d: bezier(1050, MGR_BOTTOM, 1125, WRK_TOP, CTRL_MGR_WRK), isHighLevel: false },
];

function timeAgo(d: Date | string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/* ── Map node component ──────────────────────────────────────────────────── */
function MapNode({
  node, agent, isSelected, onClick,
}: {
  node: OrgNode;
  agent?: HQAgent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const status  = agent?.status ?? (node.agentKey ? "NOT_DEPLOYED" : "VIRTUAL");
  const sColor  = agent ? statusColor(agent.status) : node.agentKey ? "#374151" : "#c9a84c44";
  const left    = node.cx - node.w / 2;
  const total   = (agent?.tasksToday.completed ?? 0) + (agent?.tasksToday.failed ?? 0);

  return (
    <div
      role="button"
      tabIndex={0}
      className="absolute cursor-pointer transition-all duration-200"
      style={{ left, top: node.cy, width: node.w, height: node.h, zIndex: hovered || isSelected ? 20 : 10 }}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-full h-full rounded-xl p-2 transition-all duration-200 relative overflow-hidden"
        style={{
          background: "rgba(8,8,16,0.92)",
          border: `1px solid ${isSelected ? node.color : hovered ? node.color + "66" : node.color + "33"}`,
          boxShadow: hovered || isSelected ? `0 0 20px 2px ${node.color}33, inset 0 0 20px ${node.color}0a` : "none",
          transform: hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl" style={{ background: node.color }} />

        {/* Level 0: CEO */}
        {node.level === 0 && (
          <div className="flex flex-col h-full justify-between p-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{node.icon}</span>
              <div>
                <p className="text-[8px] font-mono uppercase tracking-widest" style={{ color: node.color }}>
                  {node.dept}
                </p>
                <p className="text-white text-[11px] font-bold leading-tight">{node.shortTitle}</p>
              </div>
              <div className="ml-auto">
                <div className={`w-2 h-2 rounded-full ${status === "RUNNING" ? "animate-pulse" : ""}`}
                     style={{ background: sColor }} />
              </div>
            </div>
            {agent && (
              <div className="flex gap-2 text-[8px] font-mono">
                <span style={{ color: "#22c55e" }}>{agent.tasksToday.completed}✓</span>
                <span className="text-white/30">{Math.round(agent.successRate)}%</span>
                <span className="text-white/20">{timeAgo(agent.lastRunAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Level 1: Manager */}
        {node.level === 1 && (
          <div className="flex flex-col h-full justify-between py-1 px-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{node.icon}</span>
              <div className="min-w-0">
                <p className="text-[7px] font-mono uppercase tracking-widest" style={{ color: node.color }}>
                  {node.dept}
                </p>
                <p className="text-white/80 text-[10px] font-semibold leading-tight truncate">{node.shortTitle}</p>
              </div>
            </div>
            <p className="text-[8px] text-white/20 font-mono italic">Department Head</p>
          </div>
        )}

        {/* Level 2: Worker */}
        {node.level === 2 && (
          <div className="flex flex-col h-full justify-between py-0.5 px-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{node.icon}</span>
                <p className="text-white/80 text-[9px] font-semibold leading-tight">{node.shortTitle}</p>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agent?.status === "RUNNING" ? "animate-pulse" : ""}`}
                   style={{ background: sColor }} />
            </div>
            {agent ? (
              <div className="flex gap-1.5 text-[7px] font-mono mt-1">
                <span style={{ color: "#22c55e" }}>{total}t</span>
                <span className="text-white/30">{Math.round(agent.successRate)}%</span>
              </div>
            ) : (
              <p className="text-[7px] font-mono" style={{ color: node.color + "66" }}>
                {node.dept === "Shared Spaces" ? "virtual space" : "offline"}
              </p>
            )}
          </div>
        )}

        {/* Hover tooltip */}
        {hovered && node.level > 0 && (
          <div
            className="absolute z-30 rounded-xl p-3 text-left pointer-events-none"
            style={{
              top: node.level === 2 ? "auto" : "100%",
              bottom: node.level === 2 ? "100%" : "auto",
              left: node.cx > MAP_W - 300 ? "auto" : 0,
              right: node.cx > MAP_W - 300 ? 0 : "auto",
              marginTop: 8, marginBottom: 8,
              width: 200,
              background: "rgba(8,8,20,0.97)",
              border: `1px solid ${node.color}44`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.8)`,
            }}
          >
            <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: node.color }}>
              {node.dept}
            </p>
            <p className="text-white text-xs font-semibold mb-2">{node.title}</p>
            {agent && (
              <div className="grid grid-cols-2 gap-1 mb-2">
                {[
                  { l:"Status",  v: agent.status.toLowerCase() },
                  { l:"Success", v: `${Math.round(agent.successRate)}%` },
                  { l:"Tasks",   v: `${agent.totalRuns}` },
                  { l:"Memory",  v: `${agent.memoryCount}` },
                ].map(r => (
                  <div key={r.l}>
                    <p className="text-[7px] text-white/20 uppercase">{r.l}</p>
                    <p className="text-[10px] text-white/70">{r.v}</p>
                  </div>
                ))}
              </div>
            )}
            <ul className="space-y-0.5">
              {node.responsibilities.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[9px] text-white/30 flex gap-1">
                  <span style={{ color: node.color }}>›</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Ecosystem Map ──────────────────────────────────────────────────── */
export default function EcosystemMap({
  agents, onSelect,
}: {
  agents: HQAgent[];
  onSelect: (node: OrgNode) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);

  const runningAgentKeys = agents.filter(a => a.status === "RUNNING").map(a => a.name);
  const errorAgentKeys   = agents.filter(a => a.status === "ERROR").map(a => a.name);

  function connIsActive(conn: { id: string }) {
    // A connection is "active" if either endpoint node's agent is running/error
    return CONNECTIONS.find(c => c.id === conn.id) !== undefined &&
      ORG_NODES.some(n => n.agentKey && runningAgentKeys.includes(n.agentKey));
  }

  function handleSelect(node: OrgNode) {
    setSelected(node.id);
    onSelect(node);
  }

  // Legend
  const legend = [
    { color: "#c9a84c", label: "Executive" },
    { color: "#3b82f6", label: "Operations" },
    { color: "#8b5cf6", label: "Marketing" },
    { color: "#10b981", label: "Customer Success" },
    { color: "#f59e0b", label: "Revenue" },
    { color: "#94a3b8", label: "Shared Spaces" },
  ];

  const anyRunning = runningAgentKeys.length > 0;

  return (
    <div className="p-4 lg:p-6">
      {/* Legend + controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          {legend.map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-white/30">{l.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/20">
          <span>Click any node to open Agent Office</span>
          {anyRunning && (
            <span className="flex items-center gap-1 text-[#facc15]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" />
              {runningAgentKeys.length} agent{runningAgentKeys.length > 1 ? "s" : ""} running
            </span>
          )}
        </div>
      </div>

      {/* Scrollable map */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06]"
           style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.04) 0%, #030305 70%)" }}>
        <div className="relative" style={{ minWidth: MAP_W, height: MAP_H }}>

          {/* SVG connection layer */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={MAP_W} height={MAP_H}
            style={{ zIndex: 1 }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {/* Gradient for connections */}
              <linearGradient id="connGold" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#c9a84c" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="connBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {CONNECTIONS.map(conn => {
              const isLive = connIsActive(conn);
              return (
                <g key={conn.id}>
                  {/* Glow layer */}
                  <path
                    d={conn.d}
                    fill="none"
                    stroke={conn.isHighLevel ? "#c9a84c" : "#3b82f6"}
                    strokeWidth={conn.isHighLevel ? 3 : 1.5}
                    strokeOpacity={isLive ? 0.4 : 0.12}
                    filter={isLive ? "url(#glow)" : undefined}
                  />
                  {/* Animated flow */}
                  {isLive && (
                    <path
                      d={conn.d}
                      fill="none"
                      stroke={conn.isHighLevel ? "#c9a84c" : "#22c55e"}
                      strokeWidth={conn.isHighLevel ? 2 : 1.5}
                      strokeDasharray="8 6"
                      strokeDashoffset="14"
                      style={{ animation: "hqFlow 1.8s linear infinite" }}
                    />
                  )}
                </g>
              );
            })}

            {/* Department zone labels */}
            {[
              { x: 150, label: "Operations",      color: "#3b82f6" },
              { x: 450, label: "Marketing",        color: "#8b5cf6" },
              { x: 750, label: "Customer Success", color: "#10b981" },
              { x: 1050,label: "Revenue",          color: "#f59e0b" },
            ].map(z => (
              <text key={z.label} x={z.x} y={175} textAnchor="middle"
                    fill={z.color} fillOpacity={0.35} fontSize={9}
                    fontFamily="monospace" letterSpacing="3">
                {z.label.toUpperCase()}
              </text>
            ))}

            {/* Horizontal separator lines */}
            <line x1={20} y1={170} x2={MAP_W - 20} y2={170} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <line x1={20} y1={350} x2={MAP_W - 20} y2={350} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            {/* Shared Spaces separator */}
            <line x1={20} y1={460} x2={MAP_W - 20} y2={460} stroke="rgba(255,255,255,0.05)" strokeWidth={1} strokeDasharray="6 4" />
            <text x={MAP_W / 2} y={475} textAnchor="middle" fill="#94a3b8" fillOpacity={0.35} fontSize={9} fontFamily="monospace" letterSpacing="3">
              SHARED SPACES
            </text>
          </svg>

          {/* Level labels */}
          <div className="absolute left-2 flex flex-col justify-around pointer-events-none"
               style={{ top: 30, height: MAP_H - 60, zIndex: 2 }}>
            {["CEO", "MANAGEMENT", "OPERATIONS", "SPACES"].map(label => (
              <span key={label} className="text-[8px] font-mono tracking-[0.3em] text-white/10 uppercase -rotate-90 origin-center">
                {label}
              </span>
            ))}
          </div>

          {/* Agent nodes */}
          {ORG_NODES.map(node => (
            <MapNode
              key={node.id}
              node={node}
              agent={findAgent(agents, node.agentKey)}
              isSelected={selected === node.id}
              onClick={() => handleSelect(node)}
            />
          ))}

          {/* Error overlay badges */}
          {ORG_NODES.filter(n => n.agentKey && errorAgentKeys.includes(n.agentKey)).map(n => (
            <div
              key={`err-${n.id}`}
              className="absolute w-4 h-4 bg-[#ef4444] rounded-full flex items-center justify-center z-30 pointer-events-none"
              style={{ left: n.cx + n.w / 2 - 8, top: n.cy - 8 }}
            >
              <span className="text-white text-[8px] font-bold">!</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row below map */}
      <div className="flex items-center justify-center gap-8 mt-4">
        {[
          { label:"Total Agents",  val: ORG_NODES.filter(n => n.agentKey).length,          color:"#c9a84c" },
          { label:"Deployed",      val: ORG_NODES.filter(n => n.agentKey && findAgent(agents, n.agentKey)).length, color:"#22c55e" },
          { label:"Running Now",   val: runningAgentKeys.length,                            color:"#facc15" },
          { label:"Errors",        val: errorAgentKeys.length,                              color:"#ef4444" },
          { label:"Not Deployed",  val: ORG_NODES.filter(n => n.agentKey && !findAgent(agents, n.agentKey)).length, color:"#374151" },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-mono font-bold" style={{ color: s.color }}>{s.val}</div>
            <div className="text-[9px] text-white/20 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
