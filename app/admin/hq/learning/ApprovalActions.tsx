"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ApprovalActions({ itemId }: { itemId: string }) {
  const router  = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    try {
      await fetch("/api/ai/approve", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: itemId, action }),
      });
      router.refresh();
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 text-xs font-medium hover:bg-green-500/20 disabled:opacity-40 transition-colors"
      >
        {busy === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        Approve
      </button>
      <button
        onClick={() => act("reject")}
        disabled={busy !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/20 disabled:opacity-40 transition-colors"
      >
        {busy === "reject" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        Dismiss
      </button>
    </div>
  );
}
