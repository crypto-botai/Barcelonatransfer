"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Search, Send, Trash2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Conversation } from "@/lib/whatsapp-inbox";
import { GROUP_LIMITS, planBroadcast, type WaGroup } from "@/lib/whatsapp-groups";
import { toE164 } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Avatar } from "./ConversationList";

/**
 * Groups: saved lists of customers, and one message to everyone who can
 * receive it right now. See lib/whatsapp-groups.ts for why this is a list and
 * not a WhatsApp group chat, and for the 24-hour rule that keeps it from
 * being spam.
 */

export interface GroupsState {
  groups: WaGroup[] | null;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  create: (name: string) => Promise<void>;
  update: (id: string, patch: Partial<WaGroup>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  send: (id: string, text: string) => Promise<{ sent: number; skipped: { phone: string; reason: string }[] } | null>;
}

export function useGroups(enabled: boolean): GroupsState {
  const [groups, setGroups] = useState<WaGroup[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/whatsapp/groups", { cache: "no-store" });
      if (r.ok) setGroups(((await r.json()) as { groups: WaGroup[] }).groups);
    } catch { /* shown as empty; the next visit tries again */ }
  }, []);

  useEffect(() => { if (enabled && groups === null) void load(); }, [enabled, groups, load]);

  const save = useCallback(async (next: WaGroup[]): Promise<WaGroup[] | null> => {
    const before = groups;
    setGroups(next); // shown at once; the server's cleaned copy replaces it
    try {
      const r = await fetch("/api/admin/whatsapp/groups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groups: next }) });
      if (!r.ok) throw new Error("save failed");
      const saved = ((await r.json()) as { groups: WaGroup[] }).groups;
      setGroups(saved);
      return saved;
    } catch {
      setGroups(before);
      toast.error("Could not save the group. Check the connection and try again.");
      return null;
    }
  }, [groups]);

  return {
    groups,
    activeId,
    setActiveId,
    async create(name) {
      const saved = await save([...(groups ?? []), { id: "new", name, members: [] }]);
      const made = saved?.find((g) => g.name === name.replace(/\s+/g, " ").trim().slice(0, GROUP_LIMITS.name));
      if (made) setActiveId(made.id);
    },
    async update(id, patch) { await save((groups ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g))); },
    async remove(id) { await save((groups ?? []).filter((g) => g.id !== id)); if (activeId === id) setActiveId(null); },
    async send(id, text) {
      try {
        const r = await fetch(`/api/admin/whatsapp/groups/${encodeURIComponent(id)}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        const d = (await r.json().catch(() => ({}))) as { error?: string; sent?: number; skipped?: { phone: string; reason: string }[] };
        if (!r.ok) { toast.error(d.error ?? "Not sent"); return null; }
        return { sent: d.sent ?? 0, skipped: d.skipped ?? [] };
      } catch {
        toast.error("No connection. Check the internet and try again.");
        return null;
      }
    },
  };
}

// ─── The list of groups, in the left pane ────────────────────────────────────

export function GroupsList({ g }: { g: GroupsState }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await g.create(name);
    setBusy(false);
    setName("");
    setNaming(false);
  };

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3" aria-label="Groups">
      <div className="py-2">
        {naming ? (
          <form onSubmit={(e) => { e.preventDefault(); void make(); }} className="flex gap-2">
            <label className="sr-only" htmlFor="new-group">Group name</label>
            <input id="new-group" autoFocus value={name} maxLength={GROUP_LIMITS.name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Friday arrivals" className="h-10 min-w-0 flex-1 rounded-full border border-white/[0.09] bg-[#171717] px-4 text-[14px] text-white placeholder:text-dark-500 focus:border-gold-500/50 focus:outline-none" />
            <button type="submit" disabled={!name.trim() || busy} aria-label="Create group" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500 text-black disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}</button>
            <button type="button" onClick={() => { setNaming(false); setName(""); }} aria-label="Cancel" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06]"><X size={17} /></button>
          </form>
        ) : (
          <button type="button" onClick={() => setNaming(true)} disabled={(g.groups?.length ?? 0) >= GROUP_LIMITS.groups} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-gold-500/30 px-3.5 py-3 text-left text-[14px] text-gold-200 hover:bg-gold-500/[0.06] disabled:opacity-40">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500/15"><Plus size={18} /></span> New group
          </button>
        )}
      </div>

      {g.groups === null && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-dark-500" size={18} /></div>}
      {g.groups?.length === 0 && (
        <div className="px-4 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold-500/10 text-gold-400"><Users size={22} /></span>
          <p className="mt-3 text-sm font-medium text-white">No groups yet</p>
          <p className="mx-auto mt-1 max-w-[26ch] text-xs leading-relaxed text-dark-400">Make a list of customers, such as everyone arriving on Friday, and write to them all at once.</p>
        </div>
      )}
      {g.groups?.map((x) => (
        <button key={x.id} type="button" onClick={() => g.setActiveId(x.id)} aria-current={g.activeId === x.id} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/[0.04]", g.activeId === x.id && "bg-gold-500/[0.08]")}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><Users size={20} /></span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-white">{x.name}</span>
            <span className="block text-[12.5px] text-dark-400">{x.members.length} {x.members.length === 1 ? "person" : "people"}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}

// ─── One group, in the right pane ────────────────────────────────────────────

export function GroupDetail({ g, conversations, onBack, onOpenChat }: { g: GroupsState; conversations: Conversation[]; onBack: () => void; onOpenChat: (phone: string) => void }) {
  const group = g.groups?.find((x) => x.id === g.activeId) ?? null;
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [number, setNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<{ sent: number; skipped: { phone: string; reason: string }[] } | null>(null);

  useEffect(() => { setName(group?.name ?? ""); setReport(null); setText(""); setFind(""); setNumber(""); }, [group?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const byPhone = useMemo(() => new Map(conversations.map((c) => [c.phone, c])), [conversations]);
  const plan = useMemo(() => (group ? planBroadcast(group, conversations) : { eligible: [], skipped: [] }), [group, conversations]);
  const candidates = useMemo(() => {
    const q = find.trim().toLowerCase();
    return conversations
      .filter((c) => !group?.members.includes(c.phone))
      .filter((c) => !q || (c.name ?? "").toLowerCase().includes(q) || c.phone.includes(q.replace(/\s/g, "")))
      .slice(0, 12);
  }, [conversations, find, group?.members]);

  if (!group) return null;

  const add = (phones: string[]) => {
    const next = [...new Set([...group.members, ...phones])];
    if (next.length > GROUP_LIMITS.members) { toast.error(`A group holds up to ${GROUP_LIMITS.members} people.`); return; }
    void g.update(group.id, { members: next });
  };

  const addNumber = () => {
    const e164 = toE164(number.startsWith("+") || number.startsWith("00") ? number : `+${number.replace(/\D/g, "")}`);
    if (!e164) { toast.error("Enter the number with its country code, for example +34 612 345 678."); return; }
    add([e164]);
    setNumber("");
  };

  const send = async () => {
    if (!text.trim() || sending || plan.eligible.length === 0) return;
    setSending(true);
    setReport(null);
    const r = await g.send(group.id, text);
    setSending(false);
    if (r) { setReport(r); setText(""); toast.success(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}`); }
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#0f0f0f] px-2.5 py-2 sm:px-4">
        <button type="button" onClick={onBack} aria-label="Back to groups" className="grid h-10 w-10 place-items-center rounded-full text-dark-300 hover:bg-white/[0.06] hover:text-white lg:hidden"><ArrowLeft size={20} /></button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><Users size={19} /></span>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="group-name">Group name</label>
          <input id="group-name" value={name} maxLength={GROUP_LIMITS.name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== group.name && void g.update(group.id, { name })} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className="w-full truncate rounded bg-transparent text-[15px] font-medium text-white focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-gold-500/40" />
          <p className="text-[12px] text-dark-400">{group.members.length} {group.members.length === 1 ? "person" : "people"} · {plan.eligible.length} can be messaged now</p>
        </div>
        <button type="button" onClick={() => { if (window.confirm(`Delete the group "${group.name}"? The people stay in your chats.`)) void g.remove(group.id); }} aria-label="Delete group" title="Delete group" className="grid h-10 w-10 place-items-center rounded-full text-red-400/80 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={17} /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
        <section aria-label="Members">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-500">Members</h2>
          {group.members.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-dark-400">No one yet. Add people below.</p>}
          <ul className="space-y-1">
            {group.members.map((phone) => {
              const c = byPhone.get(phone);
              const ok = c?.windowOpen;
              return (
                <li key={phone} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                  <Avatar name={c?.name ?? c?.booking?.name ?? null} phone={phone} size={34} />
                  <button type="button" onClick={() => onOpenChat(phone)} className="min-w-0 flex-1 text-left" title="Open this chat">
                    <span className="block truncate text-[14px] text-white">{c?.name ?? c?.booking?.name ?? phone}</span>
                    <span className="block truncate text-[11.5px] text-dark-500">{c?.name || c?.booking?.name ? phone : c ? "In your chats" : "Not in your chats yet"}</span>
                  </button>
                  <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[10.5px] sm:inline", ok ? "bg-emerald-500/10 text-emerald-300" : "bg-white/[0.05] text-dark-400")}>{ok ? "can message now" : c ? "needs to write first" : "has not written"}</span>
                  <button type="button" onClick={() => void g.update(group.id, { members: group.members.filter((m) => m !== phone) })} aria-label={`Remove ${c?.name ?? phone}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dark-400 hover:bg-white/[0.07] hover:text-white"><X size={15} /></button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Add people" className="rounded-xl border border-white/[0.07] p-3">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-500">Add people</h2>
          <label className="relative block">
            <span className="sr-only">Find a customer</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in your chats" className="h-9 w-full rounded-full border border-white/[0.08] bg-[#171717] pl-9 pr-3 text-[13.5px] text-white placeholder:text-dark-500 focus:border-gold-500/40 focus:outline-none" />
          </label>
          <ul className="mt-2 max-h-48 space-y-px overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.phone}>
                <button type="button" onClick={() => add([c.phone])} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.05]">
                  <Avatar name={c.name} phone={c.phone} size={30} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-dark-100">{c.name ?? c.phone}</span>
                  <Plus size={15} className="text-gold-400" />
                </button>
              </li>
            ))}
            {candidates.length === 0 && <li className="px-2 py-2 text-[12.5px] text-dark-500">No one else to add from your chats.</li>}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); addNumber(); }} className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
            <label className="sr-only" htmlFor="add-number">Add by phone number</label>
            <input id="add-number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Or a number: +34 612 345 678" inputMode="tel" className="h-9 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-[#171717] px-3.5 text-[13.5px] text-white placeholder:text-dark-500 focus:border-gold-500/40 focus:outline-none" />
            <button type="submit" disabled={!number.trim()} className="rounded-full bg-white/10 px-4 text-[13px] text-white hover:bg-white/15 disabled:opacity-40">Add</button>
          </form>
        </section>

        {report && (
          <section aria-live="polite" className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[13px]">
            <p className="text-emerald-300">Sent to {report.sent} {report.sent === 1 ? "person" : "people"}.</p>
            {report.skipped.length > 0 && (
              <details className="mt-1.5 text-dark-300">
                <summary className="cursor-pointer text-dark-400">{report.skipped.length} not sent</summary>
                <ul className="mt-1 space-y-0.5 pl-1 text-[12px]">{report.skipped.map((s) => <li key={s.phone}>{byPhone.get(s.phone)?.name ?? s.phone}: {s.reason}</li>)}</ul>
              </details>
            )}
          </section>
        )}
      </div>

      <footer className="border-t border-white/[0.06] bg-[#0f0f0f] p-3">
        <label htmlFor="group-text" className="sr-only">Message to the group</label>
        <div className="flex items-end gap-2">
          <textarea id="group-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={GROUP_LIMITS.text} placeholder="Write one message to send to everyone who can receive it" className="min-h-[56px] flex-1 resize-none rounded-2xl border border-white/[0.08] bg-[#1a1a1a] px-4 py-3 text-[14.5px] text-white placeholder:text-dark-500 focus:border-gold-500/50 focus:outline-none" />
          <button type="button" onClick={() => void send()} disabled={!text.trim() || sending || plan.eligible.length === 0} className="inline-flex h-[56px] shrink-0 items-center gap-2 rounded-2xl bg-gold-500 px-4 text-[14px] font-semibold text-black hover:bg-gold-400 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-dark-500">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send to {plan.eligible.length}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-dark-500">
          Goes privately to each person, who only sees their own chat. Only people who wrote to you in the last 24 hours receive it; the others are skipped.
          {plan.skipped.length > 0 && <> {plan.skipped.length} will be skipped now.</>}
        </p>
      </footer>
    </>
  );
}
