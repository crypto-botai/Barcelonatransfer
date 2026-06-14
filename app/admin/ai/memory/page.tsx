"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, Trash2, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";

interface MemoryEntry {
  id:          string;
  type:        string;
  title:       string;
  content:     string;
  importance:  number;
  expiresAt:   string | null;
  createdAt:   string;
  agent?:      { name: string } | null;
}

interface State {
  memories: MemoryEntry[];
  total:    number;
  page:     number;
  pages:    number;
}

const TYPE_COLORS: Record<string, string> = {
  REPORT:      "text-blue-400 border-blue-500/20 bg-blue-500/5",
  FINDING:     "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  METRIC:      "text-purple-400 border-purple-500/20 bg-purple-500/5",
  DECISION:    "text-orange-400 border-orange-500/20 bg-orange-500/5",
  OBSERVATION: "text-white/50 border-white/10 bg-white/[0.03]",
};

const IMPORTANCE_STARS = (n: number) => "★".repeat(Math.max(1, Math.min(5, n))) + "☆".repeat(Math.max(0, 5 - Math.max(1, Math.min(5, n))));

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const abs  = Math.abs(diff);
  const future = diff < 0;
  const h = Math.floor(abs / 3600000);
  let label: string;
  if (h < 1) label = `${Math.floor(abs / 60000)}m`;
  else if (h < 24) label = `${h}h`;
  else label = `${Math.floor(h / 24)}d`;
  return future ? `in ${label}` : `${label} ago`;
}

export default function MemoryPage() {
  const [state, setState]         = useState<State>({ memories: [], total: 0, page: 1, pages: 1 });
  const [agentFilter, setAgentFilter] = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [agents, setAgents]       = useState<{ id: string; name: string }[]>([]);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (agentFilter) qs.set("agentId", agentFilter);
    if (typeFilter)  qs.set("type", typeFilter);
    const r = await fetch(`/api/ai/memory?${qs}`);
    if (r.ok) setState(await r.json());
    setLoading(false);
  }, [agentFilter, typeFilter]);

  // Load agent list for filter dropdown
  useEffect(() => {
    fetch("/api/ai/agents").then((r) => r.json()).then((d) => {
      if (d.agents) setAgents(d.agents.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })));
    });
  }, []);

  useEffect(() => { load(1); }, [load]);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const del = async (id: string) => {
    setDeleting(id);
    await fetch("/api/ai/memory", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setState((prev) => ({ ...prev, memories: prev.memories.filter((m) => m.id !== id), total: prev.total - 1 }));
    setDeleting(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-[#c9a84c]" />
          <div>
            <h1 className="text-lg font-display text-white">Agent Memory</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-dark-500 text-xs">{state.total} memories</span>
          <button
            onClick={() => load(state.page)}
            className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/[0.07] transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="flex-1 bg-dark-800 border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-[#c9a84c]/50"
        >
          <option value="">All Agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 bg-dark-800 border border-white/[0.07] rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-[#c9a84c]/50"
        >
          <option value="">All Types</option>
          {["REPORT", "FINDING", "METRIC", "DECISION", "OBSERVATION"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={20} className="animate-spin text-dark-500" />
        </div>
      ) : state.memories.length === 0 ? (
        <div className="text-center py-16 text-dark-500">
          <Brain size={32} className="mx-auto mb-3 opacity-20" />
          <p>No memory entries found.</p>
          <p className="text-xs mt-1">Run agents to start building agent memory.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.memories.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/[0.06] bg-dark-900 overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => toggle(m.id)}
              >
                {/* Type badge */}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${TYPE_COLORS[m.type] ?? TYPE_COLORS.OBSERVATION}`}>
                  {m.type}
                </span>

                {/* Agent */}
                <span className="text-[#c9a84c] text-[10px] w-20 flex-shrink-0 truncate">
                  {m.agent?.name ?? "—"}
                </span>

                {/* Title */}
                <span className="flex-1 text-white/80 text-xs truncate">{m.title}</span>

                {/* Importance */}
                <span className="text-yellow-500 text-[10px] flex-shrink-0 tracking-tighter" title={`Importance: ${m.importance}`}>
                  {IMPORTANCE_STARS(m.importance)}
                </span>

                {/* Age */}
                <span className="text-dark-600 text-[10px] flex-shrink-0 w-14 text-right">{timeAgo(m.createdAt)}</span>

                {/* Expiry */}
                <span className="text-dark-600 text-[10px] flex-shrink-0 w-20 text-right">
                  {m.expiresAt ? `exp ${timeAgo(m.expiresAt)}` : "no expiry"}
                </span>

                {/* Expand / Delete */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); del(m.id); }}
                    disabled={deleting === m.id}
                    className="text-dark-600 hover:text-red-400 transition-colors p-1"
                    title="Delete"
                  >
                    {deleting === m.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                  {expanded.has(m.id) ? <ChevronUp size={13} className="text-dark-500" /> : <ChevronDown size={13} className="text-dark-500" />}
                </div>
              </div>

              {/* Expanded content */}
              {expanded.has(m.id) && (
                <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                  <pre className="text-white/60 text-xs whitespace-pre-wrap font-mono leading-relaxed bg-dark-800/50 rounded-lg p-3 max-h-96 overflow-y-auto">
                    {m.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {state.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => load(state.page - 1)}
            disabled={state.page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] text-dark-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-dark-500 text-xs">
            {state.page} / {state.pages}
          </span>
          <button
            onClick={() => load(state.page + 1)}
            disabled={state.page >= state.pages}
            className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.07] text-dark-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
