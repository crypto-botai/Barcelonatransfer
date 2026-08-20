"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageCircle, RefreshCw, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ConvLog {
  id: string;
  sessionId: string;
  userMessage: string;
  assistantReply: string;
  language: string;
  escalated: boolean;
  tokensUsed: number;
  costCents: number;
  createdAt: string;
}

interface Page {
  logs: ConvLog[];
  total: number;
  page: number;
  pages: number;
}

export default function SupportPage() {
  const [data, setData]       = useState<Page | null>(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ai/support?page=${p}&limit=20`);
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageCircle size={22} className="text-green-400" />
          <div>
            <h1 className="text-xl font-display text-white">Support Chat Logs</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <button onClick={() => load(page)} className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {data && (
        <div className="mb-4 text-dark-400 text-sm">{data.total} conversations total</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : (
        <>
          <div className="space-y-2">
            {data?.logs.map((log) => (
              <div key={log.id} className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <span className="flex-shrink-0">
                    {expanded === log.id ? <ChevronDown size={14} className="text-dark-400" /> : <ChevronRight size={14} className="text-dark-400" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{log.userMessage}</p>
                    <p className="text-dark-500 text-xs mt-0.5">
                      {new Date(log.createdAt).toLocaleString("en-GB")} · {log.language.toUpperCase()} · {log.tokensUsed} tokens
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {log.escalated && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Escalated</span>
                    )}
                    <span className="text-dark-500 text-xs">€{(log.costCents / 100).toFixed(4)}</span>
                  </div>
                </button>

                {expanded === log.id && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-3">
                      <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Customer</p>
                      <p className="text-white/90 text-sm whitespace-pre-wrap">{log.userMessage}</p>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3">
                      <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">AI Reply</p>
                      <p className="text-white/80 text-sm whitespace-pre-wrap">{log.assistantReply}</p>
                    </div>
                    <div className="text-dark-500 text-xs">
                      Session: <span className="font-mono">{log.sessionId}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {data?.logs.length === 0 && (
              <div className="text-center py-16 text-dark-500">
                <MessageCircle size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No conversations yet.</p>
              </div>
            )}
          </div>

          {data && data.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm text-dark-400 hover:text-white disabled:opacity-30 transition-colors border border-white/[0.07] rounded-lg"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-dark-400">{page} / {data.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
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
