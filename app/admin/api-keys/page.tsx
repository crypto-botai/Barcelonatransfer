"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Plus, RefreshCw, Zap, Trash2, RotateCcw, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertTriangle, Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id:            string;
  provider:      string;
  label:         string;
  assignedAgent: string;
  status:        "live" | "cooling" | "dead";
  cooldownUntil: string | null;
  lastUsedAt:    string | null;
  lastError:     string | null;
  requestCount:  number;
  isEnabled:     boolean;
  createdAt:     string;
}

const PROVIDERS = ["all", "groq", "gemini", "openrouter"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_LABELS: Record<string, string> = {
  all:        "All Providers",
  groq:       "Groq",
  gemini:     "Google Gemini",
  openrouter: "OpenRouter",
};

const PROVIDER_COLORS: Record<string, string> = {
  groq:       "#f97316",
  gemini:     "#3b82f6",
  openrouter: "#8b5cf6",
};

const AGENTS = [
  "pool", "health", "seo", "analytics", "orchestrator",
  "support", "booking", "marketing", "knowledge",
];

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "live")    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 font-medium"><CheckCircle2 size={10} />live</span>;
  if (status === "cooling") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 font-medium"><Clock size={10} />cooling</span>;
  return                           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 font-medium"><XCircle size={10} />dead</span>;
}

// ─── Add Key form ─────────────────────────────────────────────────────────────

function AddKeyForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen]     = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [form, setForm]     = useState({ provider: "groq", label: "", rawKey: "", assignedAgent: "pool" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res  = await fetch("/api/admin/api-keys", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setOpen(false);
      setForm({ provider: "groq", label: "", rawKey: "", assignedAgent: "pool" });
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-[#c9a84c] text-black text-sm font-semibold rounded hover:bg-[#d4b56a] transition-colors"
      >
        <Plus size={14} /> Add Key
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="border border-white/10 rounded-lg p-4 bg-[#111] space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">Add API Key</span>
        <button type="button" onClick={() => setOpen(false)} className="text-dark-400 hover:text-white text-xs">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-dark-400 mb-1">Provider</label>
          <select
            value={form.provider}
            onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]"
          >
            {PROVIDERS.filter(p => p !== "all").map(p => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-dark-400 mb-1">Assigned Agent</label>
          <select
            value={form.assignedAgent}
            onChange={e => setForm(f => ({ ...f, assignedAgent: e.target.value }))}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#c9a84c]"
          >
            {AGENTS.map(a => <option key={a} value={a}>{a === "pool" ? "Shared Pool" : a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">Label</label>
        <input
          required value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder="e.g. Groq Key 5"
          className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-[#c9a84c]"
        />
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">API Key (will be validated then encrypted)</label>
        <input
          required value={form.rawKey}
          onChange={e => setForm(f => ({ ...f, rawKey: e.target.value }))}
          placeholder="sk-... / gsk_... / AIzaSy..."
          type="password"
          className="w-full bg-[#1a1a1a] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-[#c9a84c] font-mono"
        />
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit" disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] text-black text-sm font-semibold rounded disabled:opacity-50 hover:bg-[#d4b56a] transition-colors"
        >
          {busy ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          {busy ? "Validating…" : "Validate & Save"}
        </button>
        <span className="text-xs text-dark-500">Key will be tested before saving</span>
      </div>
    </form>
  );
}

// ─── Key table row ────────────────────────────────────────────────────────────

function KeyRow({ k, onRefresh }: { k: ApiKeyRow; onRefresh: () => void }) {
  const [testing, setTesting]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [result, setResult]     = useState<string | null>(null);

  async function test() {
    setTesting(true); setResult(null);
    const res  = await fetch(`/api/admin/api-keys/${k.id}/test`, { method: "POST" });
    const data = await res.json();
    setResult(data.ok ? `✓ ${data.latencyMs}ms` : `✗ ${data.error?.slice(0, 60)}`);
    setTesting(false); onRefresh();
  }

  async function revive() {
    setReviving(true);
    await fetch(`/api/admin/api-keys/${k.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "live" }),
    });
    setReviving(false); onRefresh();
  }

  async function del() {
    if (!confirm(`Delete "${k.label}"?`)) return;
    setDeleting(true);
    await fetch(`/api/admin/api-keys/${k.id}`, { method: "DELETE" });
    setDeleting(false); onRefresh();
  }

  const dot = PROVIDER_COLORS[k.provider] ?? "#888";
  const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("en-GB") : "never";
  const cooldown = k.cooldownUntil ? new Date(k.cooldownUntil).toLocaleString("en-GB") : null;

  return (
    <tr className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
          <span className="text-sm text-white font-medium">{k.label}</span>
        </div>
      </td>
      <td className="px-4 py-3"><StatusBadge status={k.status} /></td>
      <td className="px-4 py-3">
        <span className="text-xs text-dark-400 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">
          {k.assignedAgent === "pool" ? "shared pool" : k.assignedAgent}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-dark-400">{lastUsed}</td>
      <td className="px-4 py-3 text-xs text-dark-400 text-right">{k.requestCount.toLocaleString()}</td>
      <td className="px-4 py-3">
        {k.lastError && (
          <span className="text-xs text-red-400 font-mono" title={k.lastError}>
            {k.lastError.slice(0, 40)}…
          </span>
        )}
        {cooldown && !k.lastError && (
          <span className="text-xs text-amber-400">until {cooldown}</span>
        )}
        {result && (
          <span className={cn("text-xs font-mono", result.startsWith("✓") ? "text-green-400" : "text-red-400")}>
            {result}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={test} disabled={testing}
            title="Test key"
            className="p-1.5 rounded hover:bg-white/[0.06] text-dark-400 hover:text-[#c9a84c] disabled:opacity-40 transition-colors"
          >
            {testing ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
          </button>
          {k.status !== "live" && (
            <button
              onClick={revive} disabled={reviving}
              title="Revive key"
              className="p-1.5 rounded hover:bg-white/[0.06] text-dark-400 hover:text-green-400 disabled:opacity-40 transition-colors"
            >
              {reviving ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
            </button>
          )}
          <button
            onClick={del} disabled={deleting}
            title="Delete key"
            className="p-1.5 rounded hover:bg-red-500/10 text-dark-400 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const [keys, setKeys]         = useState<ApiKeyRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Provider>("all");
  const [seeding, setSeeding]   = useState(false);
  const [seedMsg, setSeedMsg]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/api-keys");
    const data = await res.json();
    setKeys(data.keys ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true); setSeedMsg("");
    const res  = await fetch("/api/admin/api-keys/seed", { method: "POST" });
    const data = await res.json();
    setSeedMsg(data.ok ? `Seeded: +${data.added} added, ${data.skipped} skipped` : (data.error ?? "Error"));
    setSeeding(false); load();
  }

  const shown = tab === "all" ? keys : keys.filter(k => k.provider === tab);

  const stats = {
    total:   keys.length,
    live:    keys.filter(k => k.status === "live").length,
    cooling: keys.filter(k => k.status === "cooling").length,
    dead:    keys.filter(k => k.status === "dead").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Key size={18} className="text-[#c9a84c]" />
            <h1 className="text-lg font-semibold text-white tracking-wide">API Key Manager</h1>
          </div>
          <p className="text-xs text-dark-400">Keys encrypted at rest · never sent to frontend · 24h cooldown on failure</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-dark-400 hover:text-white hover:bg-white/[0.04] rounded transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={seed} disabled={seeding}
            className="flex items-center gap-2 px-3 py-2 border border-white/10 text-dark-300 text-sm rounded hover:bg-white/[0.04] hover:text-white transition-colors disabled:opacity-50"
          >
            {seeding ? <RefreshCw size={13} className="animate-spin" /> : <Server size={13} />}
            Seed from env
          </button>
        </div>
      </div>

      {seedMsg && (
        <p className={cn("text-sm px-3 py-2 rounded border", seedMsg.startsWith("Seeded") ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-red-500/30 text-red-400 bg-red-500/5")}>
          {seedMsg}
        </p>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Keys",   value: stats.total,   color: "text-white"       },
          { label: "Live",         value: stats.live,    color: "text-green-400"   },
          { label: "Cooling 24h",  value: stats.cooling, color: "text-amber-400"   },
          { label: "Dead",         value: stats.dead,    color: "text-red-400"     },
        ].map(s => (
          <div key={s.label} className="bg-[#111] border border-white/[0.06] rounded-lg p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-dark-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Provider tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {PROVIDERS.map(p => (
          <button
            key={p} onClick={() => setTab(p)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === p
                ? "text-[#c9a84c] border-[#c9a84c]"
                : "text-dark-400 border-transparent hover:text-white",
            )}
          >
            {PROVIDER_LABELS[p]}
            {p !== "all" && (
              <span className="ml-2 text-xs text-dark-600">
                {keys.filter(k => k.provider === p).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add Key form */}
      <AddKeyForm onAdded={load} />

      {/* Keys table */}
      <div className="bg-[#0d0d0d] border border-white/[0.06] rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-dark-500">
            <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Key size={28} className="text-dark-600 mx-auto" />
            <p className="text-dark-400 text-sm">No keys yet</p>
            <p className="text-dark-600 text-xs">Add a key above or click "Seed from env" to import from environment variables</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Label", "Status", "Agent", "Last used", "Requests", "Info", ""].map((h, i) => (
                  <th key={i} className={cn(
                    "px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider",
                    i >= 4 ? "text-right" : "text-left",
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(k => <KeyRow key={k.id} k={k} onRefresh={load} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-dark-500">
        <div className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-green-400" /> live — key is healthy</div>
        <div className="flex items-center gap-1.5"><Clock size={11} className="text-amber-400" /> cooling — 24h cooldown after failure, then auto-revived</div>
        <div className="flex items-center gap-1.5"><XCircle size={11} className="text-red-400" /> dead — repeated failures, manually revive</div>
        <div className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-dark-400" /> pool — shared across all agents</div>
      </div>
    </div>
  );
}
