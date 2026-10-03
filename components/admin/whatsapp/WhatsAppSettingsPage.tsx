"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Bell, BellOff, Camera, Check, Clock, Copy, ExternalLink, ImageIcon, Loader2, MessageSquareReply, Plus, Save, Trash2, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_SETTINGS, LIMITS, isOpenNow, type QuickReply, type ServiceItem, type WhatsAppSettings } from "@/lib/whatsapp-settings";
import type { ResolvedService } from "@/lib/whatsapp-services";
import { SOUND_KEY } from "@/components/admin/WhatsAppAlerts";
import { cn } from "@/lib/utils";
import { useDesktopAlerts } from "./useDesktopAlerts";

/**
 * WhatsApp settings: everything the office can change without a developer.
 * The profile (photo and text) saves on its own; services, saved replies,
 * automatic replies and alerts save together from the bar at the bottom.
 */

interface Profile { about: string; address: string; description: string; email: string; vertical: string; websites: string[]; profile_picture_url: string | null }

const ZONES: { value: string; label: string }[] = [
  { value: "barcelona_city", label: "Barcelona city (airport fare)" },
  { value: "girona_city", label: "Girona" },
  { value: "girona_airport", label: "Girona airport" },
  { value: "sitges", label: "Sitges" },
  { value: "lloret", label: "Lloret de Mar" },
  { value: "tossa", label: "Tossa de Mar" },
  { value: "blanes", label: "Blanes" },
  { value: "roses", label: "Roses" },
  { value: "salou", label: "Salou" },
  { value: "tarragona", label: "Tarragona" },
  { value: "cambrils", label: "Cambrils" },
  { value: "cruise", label: "Cruise port" },
  { value: "andorra", label: "Andorra" },
  { value: "hourly", label: "By the hour (hourly rate)" },
  { value: "", label: "No automatic price" },
];

const VERTICALS = ["Automotive", "Travel and Transportation", "Professional Services", "Event Planning and Service", "Other"];
const DAYS = [["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0]] as const;

async function call<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, { cache: "no-store", ...init });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

// ─── Small controls ──────────────────────────────────────────────────────────

function Card({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#0f0f0f] p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-white">{title}</h2>
          {hint && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-dark-400">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label, description }: { on: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] leading-snug text-dark-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500/70", on ? "bg-gold-500" : "bg-white/15")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
      </button>
    </div>
  );
}

const field = "w-full rounded-lg border border-white/[0.09] bg-[#161616] px-3 py-2.5 text-sm text-white placeholder:text-dark-500 focus:border-gold-500/50 focus:outline-none focus:ring-1 focus:ring-gold-500/30";

function Field({ label, count, max, children, hint }: { label: string; count?: number; max?: number; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12px] font-medium text-dark-300">
        {label}
        {max !== undefined && count !== undefined && <span className={cn("tabular-nums", count > max * 0.9 ? "text-amber-300" : "text-dark-500")}>{count}/{max}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-dark-500">{hint}</span>}
    </label>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [resolved, setResolved] = useState<ResolvedService[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const alerts = useDesktopAlerts();
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState(false);

  const applyView = useCallback((v: { settings: WhatsAppSettings; services: ResolvedService[]; catalogFeedUrl: string }) => {
    setSettings(v.settings);
    setSavedJson(JSON.stringify(v.settings));
    setResolved(v.services);
    setFeedUrl(v.catalogFeedUrl);
  }, []);

  useEffect(() => {
    void call<{ settings: WhatsAppSettings; services: ResolvedService[]; catalogFeedUrl: string }>("/api/admin/whatsapp/settings").then((r) => {
      if (r.ok) applyView(r.data);
      else { toast.error(r.data.error ?? "Could not load the settings."); setSettings(DEFAULT_SETTINGS); setSavedJson(JSON.stringify(DEFAULT_SETTINGS)); }
    });
    void call<Profile>("/api/admin/whatsapp/profile").then((r) => (r.ok ? setProfile(r.data) : setProfileError(r.data.error ?? "Could not load the profile from WhatsApp.")));
    try { setSound(localStorage.getItem(SOUND_KEY) !== "0"); } catch { /* default on */ }
  }, [applyView]);

  const dirty = settings !== null && JSON.stringify(settings) !== savedJson;

  // Leaving with unsaved changes is easy to do by accident; the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (fn: (s: WhatsAppSettings) => WhatsAppSettings) => setSettings((s) => (s ? fn(s) : s));

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const r = await call<{ settings: WhatsAppSettings; services: ResolvedService[]; catalogFeedUrl: string }>("/api/admin/whatsapp/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
    }).catch(() => null);
    setSaving(false);
    if (r?.ok) { applyView(r.data); toast.success("Settings saved"); }
    else toast.error(r?.data.error ?? "Could not save. Check the connection and try again.");
  };

  const saveProfile = async () => {
    if (!profile) return;
    setProfileSaving(true);
    const { profile_picture_url: _ignored, ...body } = profile;
    void _ignored;
    const r = await call<Record<string, never>>("/api/admin/whatsapp/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    setProfileSaving(false);
    if (r?.ok) toast.success("Profile updated. WhatsApp can take a few minutes to show it.");
    else toast.error(r?.data.error ?? "Could not update the profile.");
  };

  const setPhoto = async (init: RequestInit) => {
    setPhotoBusy(true);
    const r = await call<Record<string, never>>("/api/admin/whatsapp/profile/photo", init).catch(() => null);
    if (r?.ok) {
      toast.success("Photo updated. WhatsApp can take a few minutes to show it.");
      const p = await call<Profile>("/api/admin/whatsapp/profile").catch(() => null);
      if (p?.ok) setProfile(p.data);
    } else toast.error(r?.data.error ?? "Could not change the photo.");
    setPhotoBusy(false);
  };

  const priceOf = useMemo(() => new Map(resolved.map((s) => [s.id, s])), [resolved]);

  if (!settings) {
    return <div className="grid h-[60vh] place-items-center"><Loader2 className="animate-spin text-dark-500" /></div>;
  }

  const setService = (i: number, p: Partial<ServiceItem>) => patch((s) => ({ ...s, services: s.services.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const moveService = (i: number, d: -1 | 1) =>
    patch((s) => {
      const next = [...s.services];
      const j = i + d;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...s, services: next };
    });
  const setReply = (i: number, p: Partial<QuickReply>) => patch((s) => ({ ...s, quickReplies: s.quickReplies.map((x, j) => (j === i ? { ...x, ...p } : x)) }));

  const openNow = isOpenNow(settings.away.hours);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-32 pt-16 lg:px-8 lg:pb-28 lg:pt-8">
      <div>
        <Link href="/admin/whatsapp" className="inline-flex items-center gap-1.5 text-[13px] text-dark-400 hover:text-white"><ArrowLeft size={14} /> Back to the inbox</Link>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500/80">Admin · WhatsApp</p>
        <h1 className="font-display text-3xl text-white">WhatsApp settings</h1>
        <p className="mt-1 text-sm text-dark-400">Change the business profile, the services customers can pick, your saved replies and your alerts.</p>
      </div>

      {/* ── Business profile ───────────────────────────────────────────── */}
      <Card title="Business profile" hint="What customers see when they tap the business name in WhatsApp.">
        {profileError && <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-[13px] text-amber-200/90">{profileError}</p>}
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <div className="grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-gold-500/30 bg-black">
              {profile?.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profile_picture_url} alt="Current WhatsApp profile photo" className="h-full w-full object-cover" />
              ) : (
                <Camera size={30} className="text-dark-500" />
              )}
            </div>
            <button type="button" disabled={photoBusy} onClick={() => void setPhoto({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useLogo: true }) })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-3.5 py-2 text-[13px] font-semibold text-black hover:bg-gold-400 disabled:opacity-50">
              {photoBusy ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Use the Elite BCN logo
            </button>
            <button type="button" disabled={photoBusy} onClick={() => photoInput.current?.click()} className="w-full rounded-lg border border-white/10 px-3.5 py-2 text-[13px] text-dark-200 hover:bg-white/[0.05] disabled:opacity-50">Upload another photo</button>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 4 * 1024 * 1024) { toast.error("That photo is over 4 MB."); return; }
                const form = new FormData();
                form.append("file", f);
                void setPhoto({ method: "POST", body: form });
              }}
            />
            <p className="max-w-[10rem] text-center text-[11px] leading-snug text-dark-500">JPEG or PNG, square, under 4 MB.</p>
          </div>

          <div className="grid flex-1 gap-4">
            {profile ? (
              <>
                <Field label="About (the short line under the name)" count={profile.about.length} max={139}>
                  <input className={field} maxLength={139} value={profile.about} onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
                </Field>
                <Field label="Description" count={profile.description.length} max={512}>
                  <textarea className={cn(field, "min-h-24 resize-y")} maxLength={512} value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Address" count={profile.address.length} max={256}>
                    <input className={field} maxLength={256} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={field} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                  </Field>
                  <Field label="Website">
                    <input type="url" className={field} placeholder="https://www.elitebcn.info" value={profile.websites[0] ?? ""} onChange={(e) => setProfile({ ...profile, websites: e.target.value ? [e.target.value, ...profile.websites.slice(1)] : [] })} />
                  </Field>
                  <Field label="Category">
                    <select className={field} value={profile.vertical} onChange={(e) => setProfile({ ...profile, vertical: e.target.value })}>
                      <option value="">Choose…</option>
                      {[...new Set([profile.vertical, ...VERTICALS].filter(Boolean))].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                <div>
                  <button type="button" onClick={() => void saveProfile()} disabled={profileSaving} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/15 disabled:opacity-50">
                    {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save profile
                  </button>
                  <p className="mt-2 text-[12px] text-dark-500">Opening hours cannot be shown on this kind of WhatsApp number. The automatic away message below covers it.</p>
                </div>
              </>
            ) : !profileError ? (
              <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-dark-500" /></div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Services ───────────────────────────────────────────────────── */}
      <Card
        title="Services and prices"
        hint="What customers can choose from the menu you send them. Prices come from your price table, so a change in Pricing shows here and in WhatsApp at once. WhatsApp allows ten services."
        action={
          <button
            type="button"
            disabled={settings.services.length >= LIMITS.services}
            onClick={() => patch((s) => ({ ...s, services: [...s.services, { id: `service-${Date.now().toString(36)}`, title: "", description: "", zone: null, manualFrom: null, path: "/book", image: "/whatsapp/airport-to-city.jpg", enabled: true }] }))}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-dark-100 hover:bg-white/[0.05] disabled:opacity-40"
          >
            <Plus size={14} /> Add
          </button>
        }
      >
        <ul className="space-y-3">
          {settings.services.map((s, i) => {
            const live = priceOf.get(s.id);
            return (
              <li key={s.id} className={cn("rounded-xl border p-4", s.enabled ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.05] opacity-60")}>
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" className="hidden h-20 w-20 shrink-0 rounded-lg object-cover sm:block" />
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <Field label="Name in the menu" count={s.title.length} max={LIMITS.title}>
                      <input className={field} maxLength={LIMITS.title} value={s.title} onChange={(e) => setService(i, { title: e.target.value })} />
                    </Field>
                    <Field label="Price comes from">
                      <select className={field} value={s.zone ?? ""} onChange={(e) => setService(i, { zone: e.target.value || null })}>
                        {ZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Short line under the name" count={s.description.length} max={LIMITS.description} hint={live ? `Leave empty to show: ${live.line}` : undefined}>
                      <input className={field} maxLength={LIMITS.description} value={s.description} placeholder={live?.line ?? ""} onChange={(e) => setService(i, { description: e.target.value })} />
                    </Field>
                    <Field label="Type a price instead (€, optional)" hint={live?.fromPrice && s.manualFrom === null ? `Right now: from €${live.fromPrice}${live.unit === "hour" ? "/hour" : ""} from the price table` : s.manualFrom !== null ? "This typed price overrides the table." : "No price found in the table, so type one."}>
                      <input className={field} inputMode="decimal" value={s.manualFrom ?? ""} placeholder="Automatic" onChange={(e) => { const v = e.target.value.replace(",", "."); setService(i, { manualFrom: v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : s.manualFrom }); }} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Opens this page when the customer taps Book now">
                        <input className={field} value={s.path} onChange={(e) => setService(i, { path: e.target.value })} placeholder="/book" />
                      </Field>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.05] pt-3">
                  <Toggle on={s.enabled} onChange={(v) => setService(i, { enabled: v })} label="Show this service" />
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveService(i, -1)} className="grid h-9 w-9 place-items-center rounded-lg text-dark-300 hover:bg-white/[0.06] disabled:opacity-30"><ArrowUp size={16} /></button>
                    <button type="button" aria-label="Move down" disabled={i === settings.services.length - 1} onClick={() => moveService(i, 1)} className="grid h-9 w-9 place-items-center rounded-lg text-dark-300 hover:bg-white/[0.06] disabled:opacity-30"><ArrowDown size={16} /></button>
                    <button type="button" aria-label={`Delete ${s.title || "service"}`} onClick={() => patch((x) => ({ ...x, services: x.services.filter((_, j) => j !== i) }))} className="grid h-9 w-9 place-items-center rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={16} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {settings.services.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-dark-400">No services. Add one, or the menu cannot be sent.</p>}
      </Card>

      {/* ── Catalogue ──────────────────────────────────────────────────── */}
      <Card title="Product catalogue" hint="The same services, as products customers can browse inside WhatsApp (the shop icon in your profile). Meta reads this feed on a schedule, so changing a price here changes it in the catalogue too.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[13px] text-gold-200">{feedUrl}</code>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(feedUrl).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }).catch(() => toast.error("Could not copy. Select the address and copy it by hand.")); }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-[13px] text-dark-100 hover:bg-white/[0.05]"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} {copied ? "Copied" : "Copy address"}
          </button>
          <a href="https://business.facebook.com/commerce/" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-[13px] text-dark-100 hover:bg-white/[0.05]">
            Commerce Manager <ExternalLink size={13} />
          </a>
        </div>
      </Card>

      {/* ── Saved replies ──────────────────────────────────────────────── */}
      <Card
        title="Saved replies"
        hint="Type a slash in a chat, then the word, to drop one in: /price, /flight. Edit it before sending if you want."
        action={
          <button type="button" disabled={settings.quickReplies.length >= LIMITS.quickReplies} onClick={() => patch((s) => ({ ...s, quickReplies: [...s.quickReplies, { id: `reply-${Date.now().toString(36)}`, shortcut: "", text: "" }] }))} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-dark-100 hover:bg-white/[0.05] disabled:opacity-40">
            <Plus size={14} /> Add
          </button>
        }
      >
        <ul className="space-y-3">
          {settings.quickReplies.map((r, i) => (
            <li key={r.id} className="grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 sm:grid-cols-[10rem_1fr_auto]">
              <Field label="Shortcut">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gold-400">/</span>
                  <input className={cn(field, "pl-6")} maxLength={20} value={r.shortcut} onChange={(e) => setReply(i, { shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                </div>
              </Field>
              <Field label="Message" count={r.text.length} max={LIMITS.replyText}>
                <textarea className={cn(field, "min-h-[4.5rem] resize-y")} maxLength={LIMITS.replyText} value={r.text} onChange={(e) => setReply(i, { text: e.target.value })} />
              </Field>
              <button type="button" aria-label={`Delete /${r.shortcut || "reply"}`} onClick={() => patch((s) => ({ ...s, quickReplies: s.quickReplies.filter((_, j) => j !== i) }))} className="grid h-10 w-10 place-items-center self-end rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={16} /></button>
            </li>
          ))}
          {settings.quickReplies.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-dark-400">No saved replies yet.</p>}
        </ul>
      </Card>

      {/* ── Automatic replies ──────────────────────────────────────────── */}
      <Card title="Automatic replies" hint="Sent for you the moment a customer writes. Each customer gets at most one in twelve hours, and nothing is sent to someone you have already written to in that time.">
        <div className="space-y-6">
          <div className="space-y-3">
            <Toggle on={settings.welcome.enabled} onChange={(v) => patch((s) => ({ ...s, welcome: { ...s.welcome, enabled: v } }))} label="Welcome message" description="For a customer who writes after a quiet spell. Good for a quick hello with the booking link." />
            <Field label="Welcome text" count={settings.welcome.text.length} max={LIMITS.autoText}>
              <textarea className={cn(field, "min-h-20 resize-y", !settings.welcome.enabled && "opacity-50")} maxLength={LIMITS.autoText} value={settings.welcome.text} onChange={(e) => patch((s) => ({ ...s, welcome: { ...s.welcome, text: e.target.value } }))} />
            </Field>
          </div>

          <div className="space-y-3 border-t border-white/[0.06] pt-6">
            <Toggle on={settings.away.enabled} onChange={(v) => patch((s) => ({ ...s, away: { ...s.away, enabled: v } }))} label="Away message" description="Sent when someone writes outside your opening hours." />
            <Field label="Away text" count={settings.away.text.length} max={LIMITS.autoText}>
              <textarea className={cn(field, "min-h-20 resize-y", !settings.away.enabled && "opacity-50")} maxLength={LIMITS.autoText} value={settings.away.text} onChange={(e) => patch((s) => ({ ...s, away: { ...s.away, text: e.target.value } }))} />
            </Field>
            <div>
              <p className="mb-2 text-[12px] font-medium text-dark-300">Opening hours, Barcelona time</p>
              <div className="flex flex-wrap items-center gap-2">
                {DAYS.map(([label, n]) => {
                  const on = settings.away.hours.days.includes(n);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patch((s) => ({ ...s, away: { ...s.away, hours: { ...s.away.hours, days: on ? s.away.hours.days.filter((d) => d !== n) : [...s.away.hours.days, n].sort() } } }))}
                      className={cn("h-9 w-12 rounded-lg text-[13px] font-medium transition-colors", on ? "bg-gold-500/20 text-gold-200" : "bg-white/[0.05] text-dark-400 hover:text-white")}
                    >
                      {label}
                    </button>
                  );
                })}
                <span className="mx-1 text-dark-500">from</span>
                <input type="time" aria-label="Opens at" className={cn(field, "w-28")} value={settings.away.hours.from} onChange={(e) => e.target.value && patch((s) => ({ ...s, away: { ...s.away, hours: { ...s.away.hours, from: e.target.value } } }))} />
                <span className="text-dark-500">to</span>
                <input type="time" aria-label="Closes at" className={cn(field, "w-28")} value={settings.away.hours.to} onChange={(e) => e.target.value && patch((s) => ({ ...s, away: { ...s.away, hours: { ...s.away.hours, to: e.target.value } } }))} />
              </div>
              <p className={cn("mt-2 inline-flex items-center gap-1.5 text-[12px]", openNow ? "text-emerald-300" : "text-amber-300")}>
                <Clock size={12} /> By these hours the office is {openNow ? "open" : "closed"} right now.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      <Card title="Alerts" hint="How you hear about a new customer message.">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-white">Desktop notifications on this computer</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-dark-400">
                {alerts.state === "on" && "On. A message appears on your screen even when this tab is closed, as long as the browser is open."}
                {alerts.state === "off" && "Off. Turn on to get a notification on your screen for every new message."}
                {alerts.state === "denied" && "Blocked in this browser. Click the padlock beside the address bar and set Notifications to Allow, then reload."}
                {alerts.state === "unsupported" && "This browser does not support notifications. Chrome, Edge, Firefox and Safari do."}
                {(alerts.state === "checking" || alerts.state === "busy") && "Checking…"}
              </p>
              {alerts.error && <p className="mt-1 text-[12px] text-red-300">{alerts.error}</p>}
              {alerts.state === "on" && <button type="button" onClick={() => void alerts.test()} className="mt-2 text-[12.5px] font-medium text-gold-300 hover:text-gold-200">Send a test notification</button>}
            </div>
            {(alerts.state === "on" || alerts.state === "off") && (
              <button type="button" onClick={() => void (alerts.state === "on" ? alerts.disable() : alerts.enable())} className={cn("inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium", alerts.state === "on" ? "border border-white/10 text-dark-200 hover:bg-white/[0.05]" : "bg-gold-500 text-black hover:bg-gold-400")}>
                {alerts.state === "on" ? <BellOff size={14} /> : <Bell size={14} />} {alerts.state === "on" ? "Turn off" : "Turn on"}
              </button>
            )}
          </div>

          <div className="border-t border-white/[0.06] pt-5">
            <Toggle on={sound} onChange={(v) => { setSound(v); try { localStorage.setItem(SOUND_KEY, v ? "1" : "0"); } catch { /* fine */ } }} label="Play a sound while the admin is open" description="A soft chime for a new message. Remembered on this computer only." />
          </div>
          <div className="border-t border-white/[0.06] pt-5">
            <Toggle on={settings.emailAlerts} onChange={(v) => patch((s) => ({ ...s, emailAlerts: v }))} label="Also email me every new message" description="Reaches you wherever you are, even without the browser. Turn off if desktop notifications are enough." />
          </div>
        </div>
      </Card>

      <p className="flex items-center gap-2 text-[12px] text-dark-500"><Volume2 size={12} /><MessageSquareReply size={12} /> Changes to services, saved replies, automatic replies and email alerts apply once you press Save changes.</p>

      {/* ── Save bar ───────────────────────────────────────────────────── */}
      <div className={cn("fixed inset-x-0 bottom-[3.9rem] z-30 px-4 transition-all duration-200 lg:bottom-6 lg:left-60", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-gold-500/30 bg-[#141108]/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur">
          <p className="text-[13px] text-gold-100">You have unsaved changes.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSettings(JSON.parse(savedJson))} className="rounded-lg px-3.5 py-2 text-[13px] text-dark-300 hover:bg-white/[0.06] hover:text-white">Discard</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-[13px] font-semibold text-black hover:bg-gold-400 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
