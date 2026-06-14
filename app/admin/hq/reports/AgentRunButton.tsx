"use client";

import { useState } from "react";
import { Play, Loader2, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function AgentRunButton({ agentName }: { agentName: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/ai/run", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agent: agentName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("done");
      setTimeout(() => { setState("idle"); router.refresh(); }, 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={run}
      disabled={state !== "idle"}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
        state === "done"    ? "bg-green-500/10 text-green-400 border-green-500/30" :
        state === "error"   ? "bg-red-500/10 text-red-400 border-red-500/30" :
        state === "running" ? "bg-dark-800 text-dark-400 border-white/10 cursor-wait" :
        "bg-dark-800 text-dark-400 border-white/[0.07] hover:text-white hover:border-white/20"
      }`}
    >
      {state === "running" ? <Loader2 size={11} className="animate-spin" />
       : state === "done"  ? <CheckCircle size={11} />
       : <Play size={11} />}
      {state === "running" ? "Running…"
       : state === "done"  ? "Done"
       : state === "error" ? "Failed"
       : "Run now"}
    </button>
  );
}
