"use client";

import { useState } from "react";
import { KeyRound, Loader2, Check, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Issues a temporary password and emails it to the account holder.
 *
 * Asks for confirmation first, because this invalidates whatever password the
 * person is currently using — if they are mid-shift, resetting it locks them
 * out until they read their email.
 *
 * The confirmation is drawn in the page rather than through window.confirm.
 * The native dialog is suppressed outright in installed PWAs and in several
 * mobile browsers, where it returns false without showing anything: the button
 * then does nothing at all, with no error to explain why.
 *
 * The new password is never shown here. It goes to the account's own email
 * address, so issuing one cannot be used to read into somebody's account.
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
  const [state, setState] = useState<"idle" | "confirming" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : { email }),
      });

      // Read as text first. A session that has expired redirects to the login
      // page, and res.json() on HTML throws a parse error that tells the
      // operator nothing about what actually went wrong.
      const raw = await res.text();
      let data: { error?: string; sentTo?: string } = {};
      try { data = JSON.parse(raw); } catch { /* not JSON — handled below */ }

      if (!res.ok) {
        throw new Error(
          data.error ??
          (res.status === 401
            ? "Your admin session has expired — sign in again and retry."
            : `Server returned ${res.status}`),
        );
      }
      if (!data.sentTo) throw new Error("Unexpected response from the server");

      setState("sent");
      toast.success(`Password emailed to ${data.sentTo}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send password";
      setState("idle");
      setError(msg);
      // Long, because this one matters and the reason is the useful part.
      toast.error(msg, { duration: 8000 });
    }
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
        <Check size={13} /> Sent
      </span>
    );
  }

  if (state === "confirming") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {/* In a table cell the full sentence stretches the row, so the compact
            form leans on the button labels to carry the meaning. */}
        <span className="text-[11px] text-dark-300 leading-tight">
          {compact
            ? "Replace their password?"
            : `Email a new password to ${name ?? email}? Their current one stops working.`}
        </span>
        <button
          onClick={send}
          className="px-2 py-1 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-300 hover:bg-gold-500/25 text-[11px] font-medium transition-colors"
        >
          Send it
        </button>
        <button
          onClick={() => setState("idle")}
          className="px-2 py-1 rounded-lg border border-white/[0.1] text-dark-400 hover:text-white text-[11px] transition-colors"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        onClick={() => setState("confirming")}
        disabled={state === "sending"}
        title="Email a new temporary password. They must change it at next sign-in."
        className={`inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.05] text-dark-200 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40 font-medium ${
          compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs"
        }`}
      >
        {state === "sending"
          ? <Loader2 size={12} className="animate-spin" />
          : <KeyRound size={12} />}
        {compact ? "Password" : "Send password"}
      </button>

      {/* Kept on screen after the toast fades — a failure here means somebody
          still cannot sign in, and that should not disappear after four seconds. */}
      {error && (
        <span className="inline-flex items-start gap-1 text-[10px] text-red-400 leading-tight max-w-[13rem]">
          <AlertCircle size={10} className="mt-px flex-shrink-0" /> {error}
        </span>
      )}
    </span>
  );
}
