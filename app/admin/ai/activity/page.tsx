"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Activity, RefreshCw, Loader2, Pause, Play } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id:        string;
  action:    string;
  level:     string;
  message:   string;
  tokensUsed: number;
  durationMs: number;
  createdAt: string;
  agent?:    { name: string } | null;
}

const LEVEL_STYLES: Record<string, string> = {
  info:  "text-white/70 border-white/[0.06]",
  warn:  "text-yellow-400 border-yellow-500/20",
  error: "text-red-400   border-red-500/20",
};

const LEVEL_DOT: Record<string, string> = {
  info:  "bg-blue-400",
  warn:  "bg-yellow-400",
  error: "bg-red-400",
};

const ACTION_ICON: Record<string, string> = {
  run_start:    "▶",
  run_complete: "✓",
  orchestrator_start: "⚡",
  orchestrator_done:  "✓",
  orchestrator_dispatch: "→",
  orchestrator_skip_agent: "⏭",
  api_call:     "AI",
  health_start: "🔍",
  health_complete: "🏥",
  seo_start:    "📑",
  seo_complete: "📊",
  analytics_start: "📈",
  analytics_complete: "📊",
  error:        "✗",
  skip:         "⏭",
  stale_detected: "⚠",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ActivityPage() {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [paused, setPaused]     = useState(false);
  const [latest, setLatest]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const fetchLogs = useCallback(async (since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}&limit=50` : "?limit=50";
    const r = await fetch(`/api/ai/activity${qs}`);
    if (!r.ok) return;
    const d = await r.json();
    return d as { logs: LogEntry[]; latest: string | null };
  }, []);

  // Initial load
  useEffect(() => {
    fetchLogs().then((d) => {
      if (!d) return;
      setLogs(d.logs);
      setLatest(d.latest);
      setLoading(false);
      setConnected(true);
    });
  }, [fetchLogs]);

  // Scroll on new logs
  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, paused]);

  // Poll every 3s
  useEffect(() => {
    const id = setInterval(async () => {
      if (pausedRef.current) return;
      const cur = latest;
      const d = await fetchLogs(cur ?? undefined);
      if (!d || d.logs.length === 0) return;
      setLogs((prev) => {
        const ids = new Set(prev.map((l) => l.id));
        const fresh = d.logs.filter((l) => !ids.has(l.id));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh].slice(-200);
      });
      if (d.latest) setLatest(d.latest);
    }, 3000);
    return () => clearInterval(id);
  }, [latest, fetchLogs]);

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-[#c9a84c]" />
          <div>
            <h1 className="text-lg font-display text-white">Live Activity Feed</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${connected ? "text-green-400" : "text-dark-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-dark-600"}`} />
            {connected ? "Live" : "Connecting…"}
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/[0.07] transition-colors"
          >
            {paused ? <Play size={11} /> : <Pause size={11} />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => fetchLogs().then((d) => { if (d) { setLogs(d.logs); setLatest(d.latest); } })}
            className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/[0.07] transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* Log count */}
      <p className="text-dark-600 text-[10px] mb-2 flex-shrink-0">{logs.length} entries · polling every 3s · last 200 kept</p>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-dark-900 font-mono text-xs">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 size={20} className="animate-spin text-dark-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-500 gap-2">
            <Activity size={28} className="opacity-30" />
            <p>No activity yet. Run an agent from the Agents page.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {logs.map((l) => (
              <div
                key={l.id}
                className={`flex items-start gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors border-l-2 ${LEVEL_STYLES[l.level] ?? LEVEL_STYLES.info}`}
              >
                {/* Time */}
                <span className="text-dark-600 text-[10px] pt-0.5 w-16 flex-shrink-0 tabular-nums">
                  {fmt(l.createdAt)}
                </span>

                {/* Level dot */}
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${LEVEL_DOT[l.level] ?? "bg-dark-600"}`} />

                {/* Agent badge */}
                <span className="text-[#c9a84c] text-[10px] w-20 flex-shrink-0 truncate pt-0.5">
                  {l.agent?.name ?? "system"}
                </span>

                {/* Action icon + name */}
                <span className="text-dark-500 text-[10px] w-32 flex-shrink-0 truncate pt-0.5">
                  {ACTION_ICON[l.action] ?? "·"} {l.action}
                </span>

                {/* Message */}
                <span className={`flex-1 min-w-0 break-words pt-0.5 ${LEVEL_STYLES[l.level] ?? ""}`}>
                  {l.message}
                </span>

                {/* Tokens */}
                {l.tokensUsed > 0 && (
                  <span className="text-dark-600 text-[10px] flex-shrink-0 pt-0.5 tabular-nums">
                    {l.tokensUsed.toLocaleString()}t
                  </span>
                )}

                {/* Duration */}
                {l.durationMs > 0 && (
                  <span className="text-dark-600 text-[10px] flex-shrink-0 pt-0.5 tabular-nums">
                    {l.durationMs < 1000 ? `${l.durationMs}ms` : `${(l.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
}
