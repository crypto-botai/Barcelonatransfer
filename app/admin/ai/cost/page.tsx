"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, RefreshCw, Loader2, Save, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface BudgetData {
  config: {
    id: string;
    globalMonthlyBudgetCents: number;
    alertAt80Pct: boolean;
    alertAt100Pct: boolean;
    globalKillSwitch: boolean;
    pauseAllAgentsAt100: boolean;
  } | null;
  spentCents: number;
  budgetPct: number;
  tokensUsed: number;
  breakdown: { agentName: string; costCents: number; tokensUsed: number; calls: number }[];
}

export default function CostPage() {
  const [data, setData]         = useState<BudgetData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [budget, setBudget]     = useState("");
  const [killSwitch, setKillSwitch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ai/budget");
      const d = await r.json();
      setData(d);
      setBudget(((d.config?.globalMonthlyBudgetCents ?? 2000) / 100).toFixed(2));
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
      body: JSON.stringify({
        globalMonthlyBudgetCents: Math.round(parseFloat(budget) * 100),
        globalKillSwitch: killSwitch,
      }),
    });
    await load();
    setSaving(false);
  }

  const pct = data?.budgetPct ?? 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-[#c9a84c]";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign size={22} className="text-[#c9a84c]" />
          <div>
            <h1 className="text-xl font-display text-white">Budget & Cost</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : data && (
        <>
          {/* Budget meter */}
          <div className="bg-dark-900 border border-white/[0.07] rounded-xl p-6 mb-6">
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-3xl font-display text-white">€{(data.spentCents / 100).toFixed(4)}</p>
                <p className="text-dark-400 text-sm mt-0.5">spent this month</p>
              </div>
              <div className="text-right">
                <p className="text-dark-300 text-sm">Budget: €{((data.config?.globalMonthlyBudgetCents ?? 2000) / 100).toFixed(2)}</p>
                <p className="text-dark-500 text-xs">{data.tokensUsed.toLocaleString()} tokens used</p>
              </div>
            </div>

            <div className="h-3 bg-dark-800 rounded-full overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-sm font-medium ${pct >= 100 ? "text-red-400" : pct >= 80 ? "text-yellow-400" : "text-dark-400"}`}>
              {pct}% of monthly budget
              {pct >= 80 && pct < 100 && " — approaching limit"}
              {pct >= 100 && " — LIMIT REACHED"}
            </p>
          </div>

          {/* Settings */}
          <div className="bg-dark-900 border border-white/[0.07] rounded-xl p-5 mb-6">
            <h2 className="text-white text-sm font-semibold mb-4">Budget Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-dark-400 text-xs mb-1.5 block">Monthly Budget (EUR)</label>
                <div className="flex items-center gap-2">
                  <span className="text-dark-400 text-sm">€</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-32 bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#c9a84c]/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-white/[0.05]">
                <div>
                  <p className="text-white text-sm">Global Kill Switch</p>
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
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  <AlertTriangle size={14} /> Kill switch is ON — all AI agents are paused
                </div>
              )}
            </div>

            <button onClick={save} disabled={saving} className="mt-4 flex items-center gap-2 text-sm text-black bg-[#c9a84c] hover:bg-[#d4af5a] px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Settings
            </button>
          </div>

          {/* Per-agent breakdown */}
          {data.breakdown.length > 0 && (
            <div className="bg-dark-900 border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <h2 className="text-white text-sm font-semibold">Cost Breakdown by Agent (this month)</h2>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {data.breakdown.map((row) => (
                  <div key={row.agentName} className="flex items-center gap-4 px-4 py-3">
                    <p className="flex-1 text-white text-sm capitalize">{row.agentName}</p>
                    <p className="text-dark-400 text-sm">{row.calls} calls</p>
                    <p className="text-dark-400 text-sm">{row.tokensUsed.toLocaleString()} tokens</p>
                    <p className="text-white text-sm font-medium tabular-nums">€{(row.costCents / 100).toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
