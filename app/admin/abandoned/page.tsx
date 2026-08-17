"use client";

import { useEffect, useState } from "react";
import { Clock, Mail, Tag, TrendingUp, RefreshCw, MessageCircle, Users, AlertTriangle } from "lucide-react";

type AbandonedBooking = {
  id:          string;
  email:       string;
  name:        string | null;
  phone:       string | null;
  emailSentAt: string | null;
  convertedAt: string | null;
  createdAt:   string;
  coupon: {
    code:        string;
    discountPct: number;
    usedAt:      string | null;
    expiresAt:   string;
  } | null;
};

type Funnel = {
  sessions:        number;
  withEmail:       number;
  convertedToBook: number;
  byStep:          { step: number; count: number }[];
  pendingRecovery: number;
};

/** What the customer is doing at each step of the booking form. */
const STEP_LABELS: Record<number, string> = {
  1: "Route, date & vehicle",
  2: "Extras",
  3: "Contact details",
  4: "Review & pay",
};

export default function AbandonedBookingsPage() {
  const [items,     setItems]     = useState<AbandonedBooking[]>([]);
  const [stats,     setStats]     = useState({ total: 0, converted: 0 });
  const [funnel,    setFunnel]    = useState<Funnel | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/abandoned-bookings");
      const data = await res.json();
      setItems(data.items ?? []);
      setStats({ total: data.total ?? 0, converted: data.converted ?? 0 });
      setFunnel(data.funnel ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const convRate = stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-white">Abandoned Bookings</h1>
          <p className="text-dark-400 text-sm mt-1">
            Where visitors stop, and the ones we can still email back
          </p>
        </div>
        <button onClick={load} className="btn-outline-gold px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Funnel — the whole picture. The recovery table below covers only the
          slice where an email was captured, which is a small fraction of it. */}
      {funnel && funnel.sessions > 0 && (
        <div className="glass-card rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users size={16} className="text-gold-400" />
                <p className="text-white font-medium">Booking form funnel</p>
              </div>
              <p className="text-dark-400 text-xs">
                {funnel.sessions} people started the booking form ·{" "}
                {funnel.convertedToBook} completed a booking ·{" "}
                {funnel.withEmail} left an email
              </p>
            </div>
            {funnel.pendingRecovery > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 flex-shrink-0">
                <AlertTriangle size={13} className="text-amber-400" />
                <span className="text-amber-300 text-xs">
                  {funnel.pendingRecovery} awaiting recovery email — cron may have stopped
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {funnel.byStep.map(({ step, count }) => {
              const pct = Math.round((count / funnel.sessions) * 100);
              return (
                <div key={step} className="flex items-center gap-3">
                  <span className="text-dark-400 text-xs w-40 flex-shrink-0">
                    {step}. {STEP_LABELS[step] ?? `Step ${step}`}
                  </span>
                  <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full bg-gold-500/40 border-r border-gold-500"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                  <span className="text-dark-300 text-xs w-20 text-right flex-shrink-0 tabular-nums">
                    {count} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-dark-500 text-xs mt-4 pt-3 border-t border-white/[0.06]">
            Only visitors who reach the contact step can be emailed back, so the
            recovery list below is always a fraction of the total. A large first-step
            number means people are getting a price and leaving.
          </p>
        </div>
      )}

      {/* Recovery stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Clock,       label: "Recoverable",      value: stats.total },
          { icon: TrendingUp,  label: "Converted",        value: stats.converted },
          { icon: Tag,         label: "Conversion Rate",  value: `${convRate}%` },
          { icon: Mail,        label: "Emails Sent",      value: items.filter((i) => i.emailSentAt).length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card rounded-xl p-5">
            <Icon size={18} className="text-gold-400 mb-3" />
            <p className="text-dark-400 text-xs uppercase tracking-wider">{label}</p>
            <p className="font-display text-2xl text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Email", "Name", "Phone", "Coupon", "Discount", "Sent At", "Converted", "Expires"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-dark-400 uppercase tracking-wider font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-dark-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-dark-400">No abandoned bookings yet</td></tr>
              ) : items.map((item) => {
                const isConverted = !!item.convertedAt;
                const isUsed      = !!item.coupon?.usedAt;
                const isExpired   = item.coupon ? new Date(item.coupon.expiresAt) < new Date() : false;

                return (
                  <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white">{item.email}</td>
                    <td className="px-4 py-3 text-dark-300">{item.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.phone ? (
                        <a
                          href={`https://wa.me/${item.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                            `Hi${item.name ? ` ${item.name}` : ""}! I noticed you started a booking with Elite BCN Transfers but didn't finish.${item.coupon && !item.coupon.usedAt ? ` Here's your ${item.coupon.discountPct}% discount code to complete it: ${item.coupon.code}` : " Can I help you complete it or answer any questions?"}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[#25D366] hover:text-[#2fe378] text-xs font-medium transition-colors"
                          title="Start WhatsApp conversation"
                        >
                          <MessageCircle size={13} /> {item.phone}
                        </a>
                      ) : <span className="text-dark-500 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {item.coupon ? (
                        <code className="text-gold-400 text-xs font-mono">{item.coupon.code}</code>
                      ) : <span className="text-dark-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {item.coupon ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isUsed ? "bg-green-500/20 text-green-400" :
                          isExpired ? "bg-red-500/20 text-red-400" :
                          "bg-gold-500/20 text-gold-400"
                        }`}>
                          {isUsed ? "Used" : isExpired ? "Expired" : `${item.coupon.discountPct}% OFF`}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-dark-400 text-xs">
                      {item.emailSentAt ? new Date(item.emailSentAt).toLocaleString("en-GB") : <span className="text-red-400">Not sent</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${isConverted ? "bg-green-500/20 text-green-400" : "bg-dark-500/20 text-dark-400"}`}>
                        {isConverted ? "✓ Converted" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dark-500 text-xs">
                      {item.coupon ? new Date(item.coupon.expiresAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
