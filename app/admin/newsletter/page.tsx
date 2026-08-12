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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateNewsletterHtml(f: {
  issueTeaser: string; issueMonth: string; issueYear: string; issueNumber: string;
  leadHeadline: string; leadBody: string; leadLink: string;
  tipHeadline: string; tipBody: string;
  eventHeadline: string; eventBody: string;
  offerHeadline: string; offerBody: string; offerLink: string; offerCta: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Barcelona Travel Insider — Elite BCN</title></head>
<body style="margin:0;padding:0;background-color:#efece5;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(f.issueTeaser)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece5;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
    <tr><td style="background-color:#141414;padding:36px 40px 24px 40px;text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:5px;color:#8a8a8a;text-transform:uppercase;margin-bottom:14px;">Elite BCN Presents</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#ffffff;">The Barcelona Travel Insider</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#c9a96e;padding-top:10px;text-transform:uppercase;">${esc(f.issueMonth)} ${esc(f.issueYear)} &nbsp;·&nbsp; Issue No. ${esc(f.issueNumber)}</div>
    </td></tr>
    <tr><td style="height:3px;background-color:#c9a96e;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="background-color:#faf8f4;padding:40px 48px 24px 48px;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#b39159;text-transform:uppercase;margin-bottom:14px;">Lead Story</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:32px;color:#1a1a1a;margin-bottom:16px;">${esc(f.leadHeadline)}</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:23px;color:#5c5c5c;">${esc(f.leadBody)}</div>
      ${f.leadLink ? `<div style="margin-top:20px;"><a href="${esc(f.leadLink)}" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#b39159;text-decoration:none;letter-spacing:1px;">Read more &rarr;</a></div>` : ""}
    </td></tr>
    <tr><td style="background-color:#faf8f4;padding:0 48px 32px 48px;"><div style="border-top:1px solid #e9e3d6;font-size:0;line-height:0;">&nbsp;</div></td></tr>
    <tr><td style="background-color:#faf8f4;padding:0 48px 32px 48px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;width:50%;padding-right:16px;border-right:1px solid #e9e3d6;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#b39159;text-transform:uppercase;margin-bottom:12px;">Insider Tip</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#1a1a1a;margin-bottom:10px;">${esc(f.tipHeadline)}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:21px;color:#5c5c5c;">${esc(f.tipBody)}</div>
        </td>
        <td style="vertical-align:top;width:50%;padding-left:16px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#b39159;text-transform:uppercase;margin-bottom:12px;">What's On</div>
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#1a1a1a;margin-bottom:10px;">${esc(f.eventHeadline)}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:21px;color:#5c5c5c;">${esc(f.eventBody)}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="background-color:#141414;padding:36px 48px;text-align:center;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#c9a96e;text-transform:uppercase;margin-bottom:14px;">Subscriber Privilege</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:28px;color:#ffffff;margin-bottom:14px;">${esc(f.offerHeadline)}</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:21px;color:#9a9a9a;margin-bottom:24px;">${esc(f.offerBody)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="background-color:#c9a96e;border-radius:2px;">
        <a href="${esc(f.offerLink)}" style="display:inline-block;padding:14px 36px;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:2px;color:#1a1a1a;text-decoration:none;text-transform:uppercase;font-weight:bold;">${esc(f.offerCta)}</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="background-color:#faf8f4;padding:36px 48px;text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#1a1a1a;font-style:italic;">See you at arrivals,</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#b39159;margin-top:8px;">The Elite BCN Team</div>
    </td></tr>
    <tr><td style="background-color:#141414;padding:28px 48px;text-align:center;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;letter-spacing:5px;color:#ffffff;">ELITE<span style="color:#c9a96e;">BCN</span></div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:19px;color:#8a8a8a;padding-top:12px;">+34 635 383 712 &nbsp;·&nbsp; www.elitebcn.info</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:10px;color:#4a4a4a;padding-top:12px;">
        <a href="{{UNSUB_URL}}" style="color:#4a4a4a;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td></tr>
  </table>
</td></tr>
</table></body></html>`;
}

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns,   setCampaigns]   = useState<Campaign[]>([]);
  const [stats,       setStats]       = useState({ total: 0, active: 0 });
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"subscribers" | "campaigns" | "compose">("subscribers");
  const [subject,       setSubject]       = useState("");
  const [htmlBody,      setHtmlBody]      = useState("");
  const [composeMode,   setComposeMode]   = useState<"issue" | "custom">("issue");
  const [sending,       setSending]       = useState(false);
  const [result,        setResult]        = useState<{ sent?: number; error?: string } | null>(null);

  // Newsletter issue structured fields
  const [issueTeaser,   setIssueTeaser]   = useState("");
  const [issueMonth,    setIssueMonth]    = useState(new Date().toLocaleString("en-GB", { month: "long" }));
  const [issueYear,     setIssueYear]     = useState(String(new Date().getFullYear()));
  const [issueNumber,   setIssueNumber]   = useState("1");
  const [leadHeadline,  setLeadHeadline]  = useState("");
  const [leadBody,      setLeadBody]      = useState("");
  const [leadLink,      setLeadLink]      = useState("");
  const [tipHeadline,   setTipHeadline]   = useState("");
  const [tipBody,       setTipBody]       = useState("");
  const [eventHeadline, setEventHeadline] = useState("");
  const [eventBody,     setEventBody]     = useState("");
  const [offerHeadline, setOfferHeadline] = useState("");
  const [offerBody,     setOfferBody]     = useState("");
  const [offerLink,     setOfferLink]     = useState("https://www.elitebcn.info/book");
  const [offerCta,      setOfferCta]      = useState("Book Now");

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
    if (!subject) return;
    setSending(true);
    setResult(null);
    try {
      const body = composeMode === "issue"
        ? generateNewsletterHtml({
            issueTeaser, issueMonth, issueYear, issueNumber,
            leadHeadline, leadBody, leadLink,
            tipHeadline, tipBody,
            eventHeadline, eventBody,
            offerHeadline, offerBody, offerLink, offerCta,
          })
        : htmlBody;

      if (!body.trim()) throw new Error("Email body is empty");

      const res  = await fetch("/api/admin/newsletter", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ subject, htmlBody: body }),
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

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["issue", "custom"] as const).map((m) => (
              <button key={m} onClick={() => setComposeMode(m)}
                className={`px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition-all ${
                  composeMode === m ? "bg-gold-500 text-black font-medium" : "bg-white/[0.04] text-dark-400 hover:text-white"
                }`}>
                {m === "issue" ? "Barcelona Travel Insider" : "Custom HTML"}
              </button>
            ))}
          </div>

          {/* Subject line — always shown */}
          <div>
            <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Subject Line</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Your June Barcelona Travel Insider is here"
              className="input-luxury w-full px-4 py-3 rounded-xl text-sm" />
          </div>

          {composeMode === "issue" ? (
            <div className="space-y-5">
              {/* Issue header */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Month</label>
                  <input type="text" value={issueMonth} onChange={(e) => setIssueMonth(e.target.value)}
                    className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" placeholder="June" />
                </div>
                <div>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Year</label>
                  <input type="text" value={issueYear} onChange={(e) => setIssueYear(e.target.value)}
                    className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" placeholder="2026" />
                </div>
                <div>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Issue #</label>
                  <input type="text" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)}
                    className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" placeholder="12" />
                </div>
              </div>
              <div>
                <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">Email Teaser (preheader text)</label>
                <input type="text" value={issueTeaser} onChange={(e) => setIssueTeaser(e.target.value)}
                  className="input-luxury w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="Inside: best summer spots, transfer deals, Barcelona tips..." />
              </div>

              {/* Lead story */}
              <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
                <p className="text-xs text-gold-400 uppercase tracking-wider">Lead Story</p>
                <input type="text" value={leadHeadline} onChange={(e) => setLeadHeadline(e.target.value)}
                  placeholder="Headline" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                <textarea rows={3} value={leadBody} onChange={(e) => setLeadBody(e.target.value)}
                  placeholder="Story body..." className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm resize-y" />
                <input type="url" value={leadLink} onChange={(e) => setLeadLink(e.target.value)}
                  placeholder="Read more URL (optional)" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
              </div>

              {/* Two-column */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gold-400 uppercase tracking-wider">Insider Tip</p>
                  <input type="text" value={tipHeadline} onChange={(e) => setTipHeadline(e.target.value)}
                    placeholder="Tip headline" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                  <textarea rows={3} value={tipBody} onChange={(e) => setTipBody(e.target.value)}
                    placeholder="Tip body..." className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm resize-y" />
                </div>
                <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gold-400 uppercase tracking-wider">What&apos;s On</p>
                  <input type="text" value={eventHeadline} onChange={(e) => setEventHeadline(e.target.value)}
                    placeholder="Event headline" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                  <textarea rows={3} value={eventBody} onChange={(e) => setEventBody(e.target.value)}
                    placeholder="Event body..." className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm resize-y" />
                </div>
              </div>

              {/* Offer block */}
              <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
                <p className="text-xs text-gold-400 uppercase tracking-wider">Subscriber Privilege Offer</p>
                <input type="text" value={offerHeadline} onChange={(e) => setOfferHeadline(e.target.value)}
                  placeholder="Offer headline" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                <textarea rows={2} value={offerBody} onChange={(e) => setOfferBody(e.target.value)}
                  placeholder="Offer description..." className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm resize-y" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="url" value={offerLink} onChange={(e) => setOfferLink(e.target.value)}
                    placeholder="CTA URL" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                  <input type="text" value={offerCta} onChange={(e) => setOfferCta(e.target.value)}
                    placeholder="CTA button text" className="input-luxury w-full px-3 py-2.5 rounded-xl text-sm" />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">HTML Body</label>
              <p className="text-dark-500 text-xs mb-2">Use <code className="text-gold-400">{"{{UNSUB_URL}}"}</code> for the unsubscribe link.</p>
              <textarea rows={16} value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)}
                className="input-luxury w-full px-4 py-3 rounded-xl text-xs font-mono resize-y" />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-dark-400 text-sm">
              Will send to <strong className="text-white">{stats.active}</strong> active subscribers
            </p>
            <button onClick={sendCampaign} disabled={sending || !subject}
              className="btn-gold px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-40">
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
