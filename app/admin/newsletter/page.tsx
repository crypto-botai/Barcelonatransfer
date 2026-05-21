"use client";

import { useEffect, useState } from "react";
import { Users, Send, RefreshCw, Mail, TrendingUp } from "lucide-react";

type Subscriber = {
  id:             string;
  email:          string;
  name:           string | null;
  isActive:       boolean;
  source:         string | null;
  confirmedAt:    string | null;
  unsubscribedAt: string | null;
  createdAt:      string;
};

type Campaign = {
  id:          string;
  subject:     string;
  status:      string;
  targetCount: number;
  sentAt:      string | null;
  createdAt:   string;
};

const TEMPLATE = `<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;background:#0a0a0a;color:#d0d0d0;">
  <div style="background:linear-gradient(135deg,#0a0a0a,#1a1600);padding:36px 40px 28px;text-align:center;border-bottom:1px solid #c9a84c;">
    <h1 style="color:#c9a84c;font-size:22px;letter-spacing:6px;font-weight:300;margin:0;">ÉLITE<span style="color:#fff;">BCN</span></h1>
    <p style="color:#888;font-size:11px;letter-spacing:3px;margin-top:8px;">LUXURY TRANSFERS · BARCELONA</p>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="color:#c9a84c;">{{SUBJECT}}</h2>
    <p>Dear valued guest,</p>
    <p>{{BODY_TEXT}}</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="https://www.elitebcn.info/book" style="background:#c9a84c;color:#000;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold;">Book a Transfer →</a>
    </div>
    <p style="font-size:12px;color:#555;text-align:center;">
      <a href="{{UNSUB_URL}}" style="color:#777;text-decoration:none;">Unsubscribe</a> · Élite BCN Transfers · Barcelona, Spain
    </p>
  </div>
</div>`;

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns,   setCampaigns]   = useState<Campaign[]>([]);
  const [stats,       setStats]       = useState({ total: 0, active: 0 });
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"subscribers" | "campaigns" | "compose">("subscribers");
  const [subject,     setSubject]     = useState("");
  const [htmlBody,    setHtmlBody]    = useState(TEMPLATE);
  const [sending,     setSending]     = useState(false);
  const [result,      setResult]      = useState<{ sent?: number; error?: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [subRes, camRes] = await Promise.all([
        fetch("/api/admin/newsletter?type=subscribers"),
        fetch("/api/admin/newsletter?type=campaigns"),
      ]);
      const subData = await subRes.json();
      const camData = await camRes.json();
      setSubscribers(subData.subscribers ?? []);
      setStats({ total: subData.total ?? 0, active: subData.active ?? 0 });
      setCampaigns(Array.isArray(camData) ? camData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendCampaign = async () => {
    if (!subject || !htmlBody) return;
    setSending(true);
    setResult(null);
    try {
      const res  = await fetch("/api/admin/newsletter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subject, htmlBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult({ sent: data.sent });
      load();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Send failed" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Newsletter</h1>
          <p className="text-dark-400 text-sm mt-1">Manage subscribers and send campaigns</p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users,      label: "Total Subscribers", value: stats.total },
          { icon: TrendingUp, label: "Active",            value: stats.active },
          { icon: Send,       label: "Campaigns Sent",    value: campaigns.filter((c) => c.status === "SENT").length },
          { icon: Mail,       label: "Last Campaign",     value: campaigns[0]?.sentAt ? new Date(campaigns[0].sentAt).toLocaleDateString("en-GB") : "—" },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <Icon size={18} className="text-gold-400 mb-3" />
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className="font-display text-2xl text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["subscribers", "campaigns", "compose"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-sm capitalize transition-all ${
              tab === t ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "subscribers" && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Email", "Name", "Source", "Status", "Subscribed"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
                ) : subscribers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-dark-400">No subscribers yet</td></tr>
                ) : subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{s.email}</td>
                    <td className="px-4 py-3 text-dark-300">{s.name ?? "—"}</td>
                    <td className="px-4 py-3 text-dark-400 text-xs">{s.source ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${s.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {s.isActive ? "Active" : "Unsubscribed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-500 text-xs">{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Subject", "Status", "Recipients", "Sent At"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-dark-400">No campaigns yet — compose one!</td></tr>
                ) : campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{c.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        c.status === "SENT" ? "bg-green-500/20 text-green-400" :
                        c.status === "SENDING" ? "bg-gold-500/20 text-gold-400" :
                        "bg-white/10 text-dark-400"
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-dark-300">{c.targetCount}</td>
                    <td className="px-4 py-3 text-dark-500 text-xs">{c.sentAt ? new Date(c.sentAt).toLocaleString("en-GB") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "compose" && (
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Subject Line</label>
            <input
              type="text" value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Summer Offer — 10% OFF Barcelona Transfers"
              className="input-luxury w-full px-4 py-3 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">HTML Body</label>
            <p className="text-dark-500 text-xs mb-2">Use <code className="text-gold-400">{"{{UNSUB_URL}}"}</code> for the unsubscribe link.</p>
            <textarea
              rows={16} value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className="input-luxury w-full px-4 py-3 rounded-xl text-xs font-mono resize-y"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-dark-400 text-sm">
              Will send to <strong className="text-white">{stats.active}</strong> active subscribers
            </p>
            <button
              onClick={sendCampaign}
              disabled={sending || !subject || !htmlBody}
              className="btn-gold px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-40"
            >
              <Send size={16} />
              {sending ? "Sending…" : `Send to ${stats.active} subscribers`}
            </button>
          </div>

          {result && (
            <div className={`rounded-xl p-4 text-sm ${result.error ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-green-500/10 border border-green-500/20 text-green-400"}`}>
              {result.error ?? `✓ Campaign sent to ${result.sent} subscribers`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
