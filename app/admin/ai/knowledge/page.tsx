"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, Plus, Trash2, Edit3, Save, X, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

interface KBEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  language: string;
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
}

const CATEGORIES = ["pricing", "fleet", "booking", "airport", "service", "contact", "faq", "other"];

export default function KnowledgePage() {
  const [entries, setEntries]   = useState<KBEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [filter, setFilter]     = useState("all");

  const empty = { question: "", answer: "", category: "faq", language: "en", isActive: true };
  const [draft, setDraft] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ai/knowledge?limit=200");
      const d = await r.json();
      setEntries(d.entries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!draft.question.trim() || !draft.answer.trim()) return;
    setSaving(true);
    await fetch("/api/ai/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setDraft(empty);
    setShowNew(false);
    await load();
    setSaving(false);
  }

  async function update(id: string, data: Partial<KBEntry>) {
    setSaving(true);
    await fetch(`/api/ai/knowledge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditId(null);
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/ai/knowledge/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain size={22} className="text-purple-400" />
          <div>
            <h1 className="text-xl font-display text-white">Knowledge Base</h1>
            <Link href="/admin/ai" className="text-dark-500 text-xs hover:text-dark-400">← Command Center</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-sm text-dark-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/20">
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 text-sm text-black bg-[#c9a84c] hover:bg-[#d4af5a] transition-colors px-4 py-1.5 rounded-lg font-medium"
          >
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5">
        {["all", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${filter === cat ? "bg-[#c9a84c] text-black font-medium" : "bg-dark-900 border border-white/[0.07] text-dark-400 hover:text-white"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* New entry form */}
      {showNew && (
        <div className="mb-5 bg-dark-900 border border-[#c9a84c]/30 rounded-xl p-5">
          <h2 className="text-white text-sm font-semibold mb-4">New Knowledge Entry</h2>
          <div className="space-y-3">
            <div>
              <label className="text-dark-400 text-xs mb-1 block">Question *</label>
              <input
                value={draft.question}
                onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#c9a84c]/40"
                placeholder="e.g. How much does a transfer to Sitges cost?"
              />
            </div>
            <div>
              <label className="text-dark-400 text-xs mb-1 block">Answer *</label>
              <textarea
                value={draft.answer}
                onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
                rows={4}
                className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#c9a84c]/40 resize-none"
                placeholder="Full answer that will be included in the AI context..."
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-dark-400 text-xs mb-1 block">Category</label>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-dark-400 text-xs mb-1 block">Language</label>
                <select
                  value={draft.language}
                  onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  {["en","es","ca","fr","de","it","ru","ar","zh"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={create} disabled={saving} className="flex items-center gap-2 text-sm text-black bg-[#c9a84c] px-4 py-1.5 rounded-lg font-medium disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
            </button>
            <button onClick={() => { setShowNew(false); setDraft(empty); }} className="flex items-center gap-2 text-sm text-dark-400 px-4 py-1.5 rounded-lg border border-white/[0.07]">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-dark-500" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <EditableEntry
              key={e.id}
              entry={e}
              isEditing={editId === e.id}
              onEdit={() => setEditId(e.id)}
              onCancel={() => setEditId(null)}
              onSave={(data) => update(e.id, data)}
              onDelete={() => remove(e.id)}
              saving={saving}
              categories={CATEGORIES}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-dark-500">
              <Brain size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No entries in this category.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableEntry({
  entry, isEditing, onEdit, onCancel, onSave, onDelete, saving, categories,
}: {
  entry: KBEntry;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: Partial<KBEntry>) => void;
  onDelete: () => void;
  saving: boolean;
  categories: string[];
}) {
  const [q, setQ] = useState(entry.question);
  const [a, setA] = useState(entry.answer);
  const [cat, setCat] = useState(entry.category);

  if (isEditing) {
    return (
      <div className="bg-dark-900 border border-[#c9a84c]/30 rounded-xl p-4 space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#c9a84c]/40"
        />
        <textarea
          value={a}
          onChange={(e) => setA(e.target.value)}
          rows={4}
          className="w-full bg-dark-800 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#c9a84c]/40 resize-none"
        />
        <div className="flex items-center gap-2">
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="bg-dark-800 border border-white/[0.08] rounded-lg px-2 py-1.5 text-white text-xs outline-none"
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => onSave({ question: q, answer: a, category: cat })} disabled={saving} className="flex items-center gap-1.5 text-xs text-black bg-[#c9a84c] px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
          </button>
          <button onClick={onCancel} className="flex items-center gap-1.5 text-xs text-dark-400 px-3 py-1.5 rounded-lg border border-white/[0.07]">
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-900 border border-white/[0.07] rounded-xl px-4 py-3 group">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium">{entry.question}</p>
          <p className="text-dark-400 text-xs mt-1 line-clamp-2">{entry.answer}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-full capitalize">{entry.category}</span>
            <span className="text-dark-500 text-[10px]">{entry.language.toUpperCase()}</span>
            <span className="text-dark-500 text-[10px]">{entry.usageCount} uses</span>
            {!entry.isActive && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">Inactive</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-dark-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <Edit3 size={13} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-dark-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
