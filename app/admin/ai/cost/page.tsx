"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, RefreshCw, Loader2, Save, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

interface BudgetData {
  config: {
    id: string;
    globalMonthlyBudgetCents: number;
    globalKillSwitch: boolean;
  } | null;
  spentCents: number;
  budgetPct: number;
  tokensUsed: number;
  breakdown: { agentName: string; costCents: number; tokensUsed: number; calls: number }[];
}

// Static provider map (mirrors lib/ai/providers.ts)
const AGENT_PROVIDERS: Record<string, { label: string; model: string; tier: string }> = {
  support:      { label: "Groq",          model: "llama-3.1-8b-instant",              tier: "Free" },
  booking:      { label: "Cerebras",      model: "llama3.1-8b",                       tier: "Free" },
  orchestrator: { label: "Mistral",       model: "mistral-small-latest",              tier: "Free" },
  health:       { label: "OpenRouter",    model: "llama-3.2-3b-instruct:free",        tier: "Free" },
  seo:          { label: "Google Gemini", model: "gemini-2.0-flash-lite",             tier: "Free" },
  analytics:    { label: "GitHub Models", model: "gpt-4o-mini",                       tier: "Free" },
};

export default function CostPage() {
  const [data, setData]         = useState<BudgetData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ai/budget");
      const d = await r.json();
      setData(d);
      setKillSwitch(d.config?.globalKillSwitch ?? false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    await fetch("/api/ai/budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ globalKillSwitch: killSwitch }),
    });
    await load();
    setSaving(false);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign size={22} className="text-[#c9a84c]" />
          <div>
            <h1 className="text-xl font-display text-white">Budget & Cost</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07]">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Provider map — always shown */}
      <div className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <Zap size={14} className="text-[#c9a84c]" />
          <h2 className="text-white text-sm font-semibold">Agent → Provider Map (all free tier)</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {Object.entries(AGENT_PROVIDERS).map(([agent, p]) => {
            const usage = data?.breakdown.find((r) => r.agentName === agent);
            return (
              <div key={agent} className="flex items-center gap-4 px-4 py-3">
                <div className="w-28 flex-shrink-0">
                  <p className="text-white text-sm capitalize">{agent}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[#c9a84c] text-sm font-medium">{p.label}</p>
                  <p className="text-dark-500 text-[10px] font-mono">{p.model}</p>
                </div>
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={9} /> {p.tier}
                </span>
                {usage && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-dark-400 text-xs">{usage.tokensUsed.toLocaleString()} tokens</p>
                    <p className="text-dark-600 text-[10px]">{usage.calls} calls</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : data && (
        <>
          {/* Token usage overview */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Tokens Used (month)", value: data.tokensUsed.toLocaleString() },
              { label: "Total API Calls",     value: data.breakdown.reduce((s, r) => s + r.calls, 0).toString() },
              { label: "Cost (free tier)",    value: "€0.00" },
            ].map((s) => (
              <div key={s.label} className="bg-dark-900 border border-white/[0.07] rounded-xl p-4">
                <p className="text-2xl font-display text-white">{s.value}</p>
                <p className="text-dark-500 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Kill switch */}
          <div className="bg-dark-900 border border-white/[0.07] rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Global Kill Switch</p>
                <p className="text-dark-500 text-xs mt-0.5">Immediately pause all AI agents</p>
              </div>
              <button
                onClick={() => setKillSwitch((k) => !k)}
                className={`relative w-12 h-6 rounded-full transition-colors ${killSwitch ? "bg-red-500" : "bg-dark-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${killSwitch ? "translate-x-6" : ""}`} />
              </button>
            </div>
            {killSwitch && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertTriangle size={14} /> Kill switch is ON — all AI agents paused
              </div>
            )}
            <button onClick={save} disabled={saving} className="mt-4 flex items-center gap-2 text-sm text-black bg-[#c9a84c] hover:bg-[#d4af5a] px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </button>
          </div>

          {/* Per-agent token breakdown */}
          {data.breakdown.length > 0 && (
            <div className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h2 className="text-white text-sm font-semibold">Token Usage by Agent (this month)</h2>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {data.breakdown.map((row) => {
                  const provider = AGENT_PROVIDERS[row.agentName];
                  return (
                    <div key={row.agentName} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-1">
                        <p className="text-white text-sm capitalize">{row.agentName}</p>
                        {provider && <p className="text-dark-500 text-[10px]">{provider.label} · {provider.model}</p>}
                      </div>
                      <p className="text-dark-400 text-sm tabular-nums">{row.calls} calls</p>
                      <p className="text-dark-400 text-sm tabular-nums">{row.tokensUsed.toLocaleString()} tokens</p>
                      <p className="text-green-400 text-sm font-medium tabular-nums">€0.00</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
