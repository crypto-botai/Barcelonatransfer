"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Conversation {
  bookingId: string; code: string; customer: string; driver: string | null; status: string; pickupAddress: string; dropoffAddress: string;
  pickupAt: string; lastAt: string | null; lastPreview: string | null; lastPrivate: boolean; unread: number; needsReply: boolean;
}
interface Msg {
  id: string; from: "customer" | "driver" | "office"; name: string; text: string; attachmentId: string | null; private: boolean;
  withParty: "customer" | "driver" | null; createdAt: string; clientId: string | null; pending?: boolean; failed?: boolean;
}
interface Ride {
  id: string; code: string; status: string; stage: string | null; pickupAddress: string; dropoffAddress: string; pickupAt: string; vehicleClass: string;
  passengers: number; luggage: number; flightNumber: string | null; customer: string; driver: string | null; vehicle: string | null; closedForApps: string | null;
}

const FILTERS = [
  ["all", "All"], ["active", "Active rides"], ["unread", "Unread"], ["completed", "Completed"], ["support", "Support cases"],
] as const;
type Filter = (typeof FILTERS)[number][0];
type Target = "SHARED" | "CUSTOMER" | "DRIVER";

const when = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 36);
const STATUS_TEXT = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AdminChat() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [list, setList] = useState<Conversation[] | null>(null);
  const [listError, setListError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/chat?filter=${filter}&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setList((await r.json()).conversations);
      setListError(false);
    } catch { setListError(true); }
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(loadList, 250);
    const i = setInterval(loadList, 15_000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [loadList]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]" style={{ minHeight: "70vh" }}>
      <aside className={`rounded-xl border border-dark-600 bg-dark-900 flex flex-col ${open ? "hidden lg:flex" : "flex"}`} aria-label="Conversations">
        <div className="p-3 border-b border-dark-700 space-y-2">
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booking, customer, driver, status"
            aria-label="Search conversations"
            className="w-full rounded-lg bg-dark-800 border border-dark-600 px-3 py-2 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400"
          />
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
            {FILTERS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded-full text-xs border ${filter === key ? "bg-gold-400 text-dark-900 border-gold-400" : "border-dark-600 text-dark-300 hover:border-gold-400/60"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto" style={{ maxHeight: "68vh" }}>
          {list === null && !listError && <p className="p-4 text-sm text-dark-400">Loading conversations…</p>}
          {listError && <p className="p-4 text-sm text-red-400">Could not load conversations. Retrying…</p>}
          {list && list.length === 0 && <p className="p-4 text-sm text-dark-400">No conversations match. Rides appear here once someone sends a message.</p>}
          {list?.map((c) => (
            <button key={c.bookingId} onClick={() => setOpen(c.bookingId)} aria-current={open === c.bookingId}
              className={`w-full text-left px-3 py-3 border-b border-dark-800 hover:bg-dark-800 ${open === c.bookingId ? "bg-dark-800" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white truncate">{c.customer}</span>
                <span className="text-[11px] text-dark-400 shrink-0">{c.lastAt ? when(c.lastAt) : ""}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-dark-400 mt-0.5">
                <span>{c.code}</span><span aria-hidden>·</span><span>{STATUS_TEXT(c.status)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-xs text-dark-300 truncate">
                  {c.lastPrivate && <span className="mr-1 rounded bg-gold-400/15 px-1 text-gold-400">Private</span>}
                  {c.lastPreview}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {c.needsReply && <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5">Needs reply</span>}
                  {c.unread > 0 && <span className="rounded-full bg-gold-400 text-dark-900 text-[11px] font-semibold min-w-5 h-5 px-1.5 inline-flex items-center justify-center" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {open ? <Thread key={open} bookingId={open} onBack={() => setOpen(null)} onChanged={loadList} /> : (
        <section className="hidden lg:flex rounded-xl border border-dark-600 bg-dark-900 items-center justify-center text-dark-400 text-sm p-8 xl:col-span-2">
          Choose a conversation to read it and reply.
        </section>
      )}
    </div>
  );
}

function Thread({ bookingId, onBack, onChanged }: { bookingId: string; onBack: () => void; onChanged: () => void }) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [text, setText] = useState("");
  const [target, setTarget] = useState<Target>("SHARED");
  const [photo, setPhoto] = useState<{ id: string; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const mark = useCallback(async () => {
    await fetch(`/api/admin/chat/${bookingId}/read`, { method: "POST" }).catch(() => undefined);
    onChanged();
  }, [bookingId, onChanged]);

  const load = useCallback(async (initial: boolean) => {
    try {
      const r = await fetch(`/api/admin/chat/${bookingId}${!initial && last.current ? `?after=${encodeURIComponent(last.current)}` : ""}`, { cache: "no-store" });
      if (r.status === 404) { setError("This conversation no longer exists."); return; }
      if (r.status === 401) { setError("You do not have permission to read this conversation."); return; }
      if (!r.ok) throw new Error();
      const j = await r.json();
      setOffline(false);
      if (initial) { setRide(j.ride); setMsgs(j.messages); setHasMore(j.hasMore); }
      else if (j.messages.length) setMsgs((cur) => [...cur.filter((m) => !m.pending), ...j.messages.filter((m: Msg) => !cur.some((c) => c.id === m.id))]);
      const tail = (j.messages as Msg[]).at(-1);
      if (tail) { last.current = tail.createdAt; if (!initial || j.unread) void mark(); }
    } catch { setOffline(true); }
  }, [bookingId, mark]);

  useEffect(() => { void load(true); const i = setInterval(() => void load(false), 5000); return () => clearInterval(i); }, [load]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const older = async () => {
    const first = msgs[0]; if (!first) return;
    const r = await fetch(`/api/admin/chat/${bookingId}?before=${encodeURIComponent(first.createdAt)}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setMsgs((cur) => [...j.messages, ...cur]); setHasMore(j.hasMore);
  };

  const post = async (m: { clientId: string; text: string; attachmentId?: string; target: Target }) => {
    const r = await fetch(`/api/admin/chat/${bookingId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: m.clientId, text: m.text, attachmentId: m.attachmentId, scope: m.target === "SHARED" ? "SHARED" : "PRIVATE", to: m.target === "SHARED" ? undefined : m.target }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not send");
    return (await r.json()).message as Msg;
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !photo) || busy) return;
    const clientId = uid();
    const draft: Msg = { id: `tmp-${clientId}`, from: "office", name: "Elite BCN", text: body, attachmentId: photo?.id ?? null, private: target !== "SHARED", withParty: target === "SHARED" ? null : target === "DRIVER" ? "driver" : "customer", createdAt: new Date().toISOString(), clientId, pending: true };
    setBusy(true); setMsgs((c) => [...c, draft]); setText(""); const att = photo; setPhoto(null);
    try {
      const saved = await post({ clientId, text: body, attachmentId: att?.id, target });
      setMsgs((c) => c.map((m) => (m.id === draft.id ? saved : m))); last.current = saved.createdAt; onChanged();
    } catch {
      setMsgs((c) => c.map((m) => (m.id === draft.id ? { ...m, pending: false, failed: true, attachmentId: att?.id ?? null } : m)));
    } finally { setBusy(false); }
  };

  const retry = async (m: Msg) => {
    setMsgs((c) => c.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)));
    try {
      // Same clientId: if the first try did arrive, the server returns that message instead of making a second one.
      const saved = await post({ clientId: m.clientId!, text: m.text, attachmentId: m.attachmentId ?? undefined, target: m.private ? (m.withParty === "driver" ? "DRIVER" : "CUSTOMER") : "SHARED" });
      setMsgs((c) => c.map((x) => (x.id === m.id ? saved : x)));
    } catch { setMsgs((c) => c.map((x) => (x.id === m.id ? { ...x, failed: true, pending: false } : x))); }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Only JPEG, PNG or WebP photos can be sent."); return; }
    if (file.size > 1_500_000) { setError("That photo is over 1.5 MB. Choose a smaller one."); return; }
    const data = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
    const r = await fetch(`/api/admin/chat/${bookingId}/photos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Could not upload that photo."); return; }
    setError(null); setPhoto({ id: (await r.json()).attachmentId, preview: data });
  };

  const closedHint = ride?.closedForApps;
  const noDriver = !ride?.driver;

  return (
    <>
      <section className="rounded-xl border border-dark-600 bg-dark-900 flex flex-col min-w-0" aria-label="Conversation">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
          <button onClick={onBack} className="lg:hidden text-gold-400 text-sm" aria-label="Back to conversations">Back</button>
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{ride?.customer ?? "Loading…"}{ride?.driver ? <span className="text-dark-400"> · {ride.driver}</span> : null}</div>
            <div className="text-xs text-dark-400">{ride ? `${ride.code} · ${STATUS_TEXT(ride.status)}` : ""}</div>
          </div>
          {offline && <span className="ml-auto text-xs rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5" role="status">Offline: retrying</span>}
        </header>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-2" style={{ maxHeight: "52vh", minHeight: 280 }} aria-live="polite">
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          {hasMore && <button onClick={older} className="mx-auto block text-xs text-gold-400 hover:underline">Load earlier messages</button>}
          {ride && msgs.length === 0 && !error && <p className="text-sm text-dark-400 text-center py-8">No messages yet. Say hello to start the conversation.</p>}
          {msgs.map((m) => <Bubble key={m.id} m={m} bookingId={bookingId} onRetry={() => void retry(m)} />)}
          <div ref={bottom} />
        </div>

        <footer className="border-t border-dark-700 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Who can see this message">
            {([["SHARED", "Shared: customer, driver and office"], ["CUSTOMER", "Private to customer"], ["DRIVER", "Private to driver"]] as const).map(([k, label]) => (
              <button key={k} role="radio" aria-checked={target === k} disabled={k === "DRIVER" && noDriver} onClick={() => setTarget(k)}
                className={`px-2.5 py-1 rounded-full text-xs border disabled:opacity-40 ${target === k ? (k === "SHARED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/60" : "bg-gold-400/20 text-gold-300 border-gold-400") : "border-dark-600 text-dark-300"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-400" id="chat-privacy">
            {target === "SHARED" ? "Everyone on this ride will see this message." : `Only the ${target === "DRIVER" ? "driver" : "customer"} and the office can see this. Their notification will not show what it says. It is still stored by Elite BCN and logged.`}
          </p>
          {closedHint && <p className="text-xs text-amber-300">{closedHint} You can still write; the customer and driver apps are read-only.</p>}
          {photo && (
            <div className="flex items-center gap-2">
              <img src={photo.preview} alt="Photo to send" className="h-14 w-14 rounded-lg object-cover border border-dark-600" />
              <button onClick={() => setPhoto(null)} className="text-xs text-dark-300 hover:text-white">Remove</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => fileInput.current?.click()} aria-label="Attach a photo" className="h-10 w-10 shrink-0 rounded-lg border border-dark-600 text-gold-400 hover:border-gold-400">+</button>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} aria-describedby="chat-privacy" aria-label="Message"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Write a message…" className="flex-1 resize-none rounded-lg bg-dark-800 border border-dark-600 px-3 py-2 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-gold-400" />
            <button onClick={() => void send()} disabled={busy || (!text.trim() && !photo)} className="h-10 px-4 rounded-lg bg-gold-400 text-dark-900 font-semibold disabled:opacity-40">Send</button>
          </div>
        </footer>
      </section>

      {ride && (
        <aside className="hidden xl:block rounded-xl border border-dark-600 bg-dark-900 p-4 text-sm space-y-3 self-start" aria-label="Ride information">
          <h2 className="text-white font-medium">Ride information</h2>
          <Info label="Booking" value={ride.code} />
          <Info label="Status" value={`${STATUS_TEXT(ride.status)}${ride.stage ? ` · ${STATUS_TEXT(ride.stage)}` : ""}`} />
          <Info label="Pickup time" value={when(ride.pickupAt)} />
          <Info label="Pickup" value={ride.pickupAddress} />
          <Info label="Drop-off" value={ride.dropoffAddress} />
          <Info label="Customer" value={ride.customer} />
          <Info label="Driver" value={ride.driver ?? "Not assigned yet"} />
          {ride.vehicle && <Info label="Vehicle" value={ride.vehicle} />}
          <Info label="Passengers / bags" value={`${ride.passengers} / ${ride.luggage}`} />
          {ride.flightNumber && <Info label="Flight" value={ride.flightNumber} />}
        </aside>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-dark-400">{label}</div><div className="text-dark-100 break-words">{value}</div></div>;
}

function Bubble({ m, bookingId, onRetry }: { m: Msg; bookingId: string; onRetry: () => void }) {
  const office = m.from === "office";
  const who = m.from === "customer" ? "Customer" : m.from === "driver" ? "Driver" : "Office";
  const scope = m.private ? `Private ${office ? "to" : "from"} ${m.withParty}` : "Shared";
  return (
    <div className={`flex ${office ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 border ${m.private ? "border-gold-400/70 bg-gold-400/10" : office ? "border-sky-500/40 bg-sky-500/10" : "border-dark-600 bg-dark-800"} ${m.failed ? "border-red-500" : ""}`}>
        <div className="flex items-center gap-2 text-[11px] mb-0.5">
          <span className="text-dark-300">{m.name} · {who}</span>
          <span className={`rounded px-1 ${m.private ? "bg-gold-400/20 text-gold-300" : "bg-emerald-500/15 text-emerald-300"}`}>{scope}</span>
        </div>
        {m.attachmentId && (
          <img src={`/api/admin/chat/${bookingId}/photos/${m.attachmentId}`} alt="Photo in the conversation" className="rounded-lg max-h-56 mb-1" />
        )}
        {m.text && <p className="text-sm text-white whitespace-pre-wrap break-words">{m.text}</p>}
        <div className="text-[11px] text-dark-400 mt-1 text-right">
          {m.failed ? <button onClick={onRetry} className="text-red-400 underline">Not sent. Tap to retry</button> : m.pending ? "Sending…" : hhmm(m.createdAt)}
        </div>
      </div>
    </div>
  );
}
