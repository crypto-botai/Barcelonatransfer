"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Mail, CreditCard, Key, Globe, Phone, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function AdminSettingsPage() {
  const [testingEmail, setTestingEmail] = useState(false);

  const testEmail = async () => {
    setTestingEmail(true);
    try {
      const res  = await fetch("/api/admin/settings/test-email", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.ok) {
        toast.success(`Test email sent to ${json.to}`);
      } else {
        const hint = json.hint ? ` — ${json.hint}` : "";
        toast.error(`Email failed: ${json.error ?? "unknown error"}${hint}`, { duration: 8000 });
      }
    } catch { toast.error("Failed to reach server"); }
    finally { setTestingEmail(false); }
  };

  const CONFIG_ITEMS = [
    { icon: Globe,      label: "Domain",          value: "www.elitebcn.info",               ok: true },
    { icon: Mail,       label: "Email FROM",       value: "noreply@elitebcntransfers.com",   ok: true },
    { icon: Mail,       label: "Admin Email",      value: "vtcbcn2025@gmail.com",             ok: true },
    { icon: CreditCard, label: "SumUp Payments",   value: "Merchant: MC9KDVYQ",              ok: true },
    { icon: Phone,      label: "WhatsApp",         value: "+34 635 383 712",                 ok: true },
    { icon: Key,        label: "Google OAuth",     value: "Configured in Vercel",            ok: true },
  ];

  const QUICK_LINKS = [
    { label: "Vercel Dashboard",       href: "https://vercel.com/nomi-s-projects1/barcelonatransfer-gsj6" },
    { label: "Neon Database",          href: "https://neon.tech/dashboard" },
    { label: "SumUp Merchant",         href: "https://me.sumup.com" },
    { label: "Resend Email",           href: "https://resend.com/overview" },
  ];

  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white">Settings</h1>
        <p className="text-dark-400 mt-1">Platform configuration and integrations</p>
      </div>

      {/* Config status */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <h2 className="text-white font-medium mb-4">Configuration Status</h2>
        <div className="space-y-3">
          {CONFIG_ITEMS.map(({ icon: Icon, label, value, ok }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={15} className="text-dark-500 flex-shrink-0" />
              <span className="text-dark-400 text-sm w-36 flex-shrink-0">{label}</span>
              <span className="text-white text-sm flex-1">{value}</span>
              {ok
                ? <CheckCircle2 size={15} className="text-green-400 flex-shrink-0" />
                : <XCircle size={15} className="text-red-400 flex-shrink-0" />
              }
            </div>
          ))}
        </div>
      </div>

      {/* Email test */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <h2 className="text-white font-medium mb-2">Email Test</h2>
        <p className="text-dark-400 text-sm mb-4">Send a test email to verify Resend is working correctly.</p>
        <button onClick={testEmail} disabled={testingEmail}
          className="btn-gold flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold">
          {testingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          {testingEmail ? "Sending…" : "Send Test Email"}
        </button>
      </div>

      {/* Quick links */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-white font-medium mb-4">External Dashboards</h2>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.08] text-dark-400 hover:text-white hover:border-gold-500/30 transition-all text-sm">
              <Globe size={13} className="text-gold-500" />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
