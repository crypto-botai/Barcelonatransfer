"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, RefreshCw, Loader2, Download, Search } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: string;
  agentId: string;
  agentName: string;
  level: string;
  message: string;
  tokensUsed: number;
  costCents: number;
  durationMs: number;
  createdAt: string;
}

const LEVEL_COLOR: Record<string, string> = {
  INFO:    "text-blue-400",
  SUCCESS: "text-green-400",
  WARN:    "text-yellow-400",
  ERROR:   "text-red-400",
  DEBUG:   "text-dark-500",
};

const LEVEL_BG: Record<string, string> = {
  INFO:    "bg-blue-500/5 border-blue-500/10",
  SUCCESS: "bg-green-500/5 border-green-500/10",
  WARN:    "bg-yellow-500/5 border-yellow-500/10",
  ERROR:   "bg-red-500/10 border-red-500/20",
  DEBUG:   "bg-dark-900 border-white/[0.04]",
};

export default function LogsPage() {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState("");
  const [level, setLevel]       = useState("");
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);

  const load = useCallback(async (p: number, q: string, l: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "40" });
      if (q) params.set("query", q);
      if (l) params.set("level", l);
      const r = await fetch(`/api/ai/logs?${params}`);
      const d = await r.json();
      setLogs(d.logs ?? []);
      setTotal(d.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, query, level); }, [load, page, query, level]);

  function downloadCSV() {
    const params = new URLSearchParams({ format: "csv" });
    if (query) params.set("query", query);
    if (level) params.set("level", level);
    window.open(`/api/ai/logs?${params}`, "_blank");
  }

  const pages = Math.ceil(total / 40);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={22} className="text-dark-400" />
          <div>
            <h1 className="text-xl font-display text-white">AI Logs</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCSV} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => load(page, query, level)} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search logs…"
            className="w-full bg-dark-900 border border-white/[0.07] rounded-lg pl-8 pr-3 py-2 text-white text-sm outline-none focus:border-white/20 placeholder-dark-600"
          />
        </div>
        <select
          value={level}
          onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          className="bg-dark-900 border border-white/[0.07] rounded-lg px-3 py-2 text-white text-sm outline-none"
        >
          <option value="">All levels</option>
          {["INFO","SUCCESS","WARN","ERROR","DEBUG"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 text-dark-500 text-xs">{total.toLocaleString()} entries</div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : (
        <>
          <div className="space-y-1.5">
            {logs.map((log) => (
              <div key={log.id} className={`border rounded-xl px-4 py-3 ${LEVEL_BG[log.level] ?? "bg-dark-900 border-white/[0.07]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 flex-shrink-0 w-14 ${LEVEL_COLOR[log.level] ?? "text-dark-400"}`}>
                    {log.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm">{log.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-dark-500 text-[10px] capitalize">{log.agentName}</span>
                      {log.tokensUsed > 0 && <span className="text-dark-600 text-[10px]">{log.tokensUsed} tok</span>}
                      {log.costCents > 0 && <span className="text-dark-600 text-[10px]">€{(log.costCents/100).toFixed(4)}</span>}
                      {log.durationMs > 0 && <span className="text-dark-600 text-[10px]">{log.durationMs}ms</span>}
                    </div>
                  </div>
                  <span className="text-dark-700 text-[10px] flex-shrink-0 font-mono">
                    {new Date(log.createdAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="text-center py-16 text-dark-500">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No logs found.</p>
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm text-dark-400 hover:text-white disabled:opacity-30 transition-colors border border-white/[0.07] rounded-lg"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-dark-400">{page} / {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 text-sm text-dark-400 hover:text-white disabled:opacity-30 transition-colors border border-white/[0.07] rounded-lg"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
