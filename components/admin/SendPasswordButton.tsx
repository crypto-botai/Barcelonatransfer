"use client";

import { useState } from "react";
import { KeyRound, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Issues a temporary password and emails it to the account holder.
 *
 * Confirms first, because this immediately invalidates whatever password the
 * person is currently using — if they are mid-shift and know their password,
 * resetting it locks them out until they read their email.
 *
 * The new password is never shown here. It goes to the account's own email
 * address, so the operator cannot use this to read into someone's account.
 */
export default function SendPasswordButton({
  userId,
  email,
  name,
  compact = false,
}: {
  userId?: string;
  email: string;
  name?: string | null;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    const ok = window.confirm(
      [
        `Send a new temporary password to ${name ?? email}?`,
        "",
        `It will be emailed to ${email}.`,
        "",
        "Their current password stops working immediately, and they will be",
        "asked to choose a new one when they next sign in.",
      ].join("\n"),
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : { email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send");
      setSent(true);
      toast.success(`Password sent to ${data.sentTo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send password");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
        <Check size={13} /> Sent
      </span>
    );
  }

  return (
    <button
      onClick={send}
      disabled={busy}
      title="Email a new temporary password. They must change it at next sign-in."
      className={`inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] text-dark-200 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40 font-medium ${
        compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs"
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
      {compact ? "Password" : "Send password"}
    </button>
  );
}
