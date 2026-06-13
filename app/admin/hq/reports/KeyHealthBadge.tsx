"use client";

import { useState, useEffect } from "react";

type Status = "live" | "cooling" | "dead" | "unconfigured" | "unknown";

const DOT: Record<Status, string> = {
  live:          "bg-green-400",
  cooling:       "bg-yellow-400 animate-pulse",
  dead:          "bg-red-400",
  unconfigured:  "bg-dark-600",
  unknown:       "bg-dark-600",
};

const LABEL: Record<Status, string> = {
  live:         "live",
  cooling:      "cooling",
  dead:         "dead",
  unconfigured: "not configured",
  unknown:      "unknown",
};

export function KeyHealthBadge({
  envKey,
  configured,
}: {
  envKey:     string;
  configured: boolean;
}) {
  const [status, setStatus] = useState<Status>(configured ? "unknown" : "unconfigured");

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    fetch("/api/ai/keys")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.providers) return;
        const match = data.providers.find((p: { envKey: string; status: string }) => p.envKey === envKey);
        if (match) setStatus(match.status as Status);
        else       setStatus("live"); // no failures recorded yet — assume live
      })
      .catch(() => setStatus("unknown"));
    return () => { cancelled = true; };
  }, [envKey, configured]);

  return (
    <span className="flex items-center gap-1.5 text-[10px] text-dark-400">
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[status]}`} />
      <span>{LABEL[status]}</span>
    </span>
  );
}
