"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle } from "lucide-react";

export function TriggerReviewButton({ agentName }: { agentName: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function trigger() {
    setState("loading");
    try {
      await fetch("/api/ai/learning", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agentName }),
      });
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={trigger}
      disabled={state !== "idle"}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-800 text-dark-400 border border-white/[0.07] text-[11px] hover:text-white hover:border-white/20 disabled:opacity-50 transition-all capitalize"
    >
      {state === "loading" ? <Loader2 size={10} className="animate-spin" />
       : state === "done"  ? <CheckCircle size={10} className="text-green-400" />
       : <Play size={10} />}
      {agentName}
    </button>
  );
}
