"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Sheet, whenParts } from "@/components/partner/ui";
import TripChat from "@/components/chat/TripChat";

const LiveMap = dynamic(() => import("@/components/dashboard/LiveMap"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-2xl bg-white/[0.03]" /> });

/**
 * The three things a dispatcher wants on a job once a driver is on it: where
 * the driver is, what happened if the passenger never came, and a line to the
 * customer. Each is a sheet over the job list, so the list is never lost.
 */

export type JobForTools = {
  id: string; confirmationCode: string; status: string;
  pickupAddress: string; dropoffAddress: string; pickupDatetime: string;
  pickupLat?: number | null; pickupLng?: number | null; dropoffLat?: number | null; dropoffLng?: number | null;
  driver: { user: { name: string | null } } | null;
  noShow?: { images: string[]; note: string | null; waitedMin: number | null; createdAt: string; lat: number | null; lng: number | null } | null;
};

type Point = { lat: number; lng: number; speed?: number; heading?: number; createdAt?: string };

export function LiveLocationSheet({ job, onClose }: { job: JobForTools | null; onClose: () => void }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [live, setLive] = useState<boolean | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [pax, setPax] = useState<{ lat: number; lng: number; at: string } | null>(null);

  useEffect(() => {
    if (!job) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/tracking?bookingId=${job.id}&trail=1`, { cache: "no-store" });
        if (!r.ok || stop) return;
        const d = await r.json();
        setLive(Boolean(d.live));
        if (d.point) { setPoint(d.point); setAt(d.point.createdAt ?? null); }
        if (Array.isArray(d.trail)) setTrail(d.trail);
        const c = await fetch(`/api/bookings/${job.id}/customer-location`, { cache: "no-store" });
        if (c.ok && !stop) { const cd = await c.json(); setPax(cd.sharing && cd.lat != null ? { lat: cd.lat, lng: cd.lng, at: cd.at } : null); }
      } catch { /* next tick */ }
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [job]);

  const w = job ? whenParts(job.pickupDatetime) : null;
  return (
    <Sheet open={Boolean(job)} onClose={onClose} title="Live location">
      {job && w && (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[11px] tracking-wider text-gold-400">{job.confirmationCode}</p>
            <p className="text-sm text-white">{job.driver?.user.name ?? "Driver"} · {w.day} at {w.time}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            <LiveMap
              driverLat={point?.lat} driverLng={point?.lng}
              pickupLat={job.pickupLat ?? undefined} pickupLng={job.pickupLng ?? undefined}
              dropoffLat={job.dropoffLat ?? undefined} dropoffLng={job.dropoffLng ?? undefined}
              trackingHistory={trail}
              driverStatus={job.status}
            />
          </div>
          {pax && (
            <p className="text-xs text-emerald-300">
              The passenger is sharing their position too: <a href={`https://www.google.com/maps?q=${pax.lat},${pax.lng}`} target="_blank" rel="noreferrer" className="underline">open on a map</a>.
            </p>
          )}
          <p className="text-xs text-dark-400">
            {live === null ? <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Checking</span>
              : live && at ? `Last position ${new Date(at).toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit" })}. Updates every few seconds while the driver shares.`
              : "No position yet. The driver shares their location from their portal once they start the trip; ask them to allow location if nothing appears."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

export function NoShowSheet({ job, onClose }: { job: JobForTools | null; onClose: () => void }) {
  const ns = job?.noShow;
  return (
    <Sheet open={Boolean(job)} onClose={onClose} title="No-show proof">
      {job && ns && (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[11px] tracking-wider text-gold-400">{job.confirmationCode}</p>
            <p className="text-sm text-white">{job.pickupAddress}</p>
            <p className="text-xs text-dark-400">Filed {new Date(ns.createdAt).toLocaleString("en-GB", { timeZone: "Europe/Madrid" })}{ns.waitedMin != null ? ` after waiting ${ns.waitedMin} min` : ""}</p>
          </div>
          {ns.note && <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-dark-100">{ns.note}</p>}
          {ns.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {ns.images.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-white/[0.08]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`No-show photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : <p className="text-xs text-dark-500">No photos were attached.</p>}
          {ns.lat != null && ns.lng != null && (
            <a href={`https://www.google.com/maps?q=${ns.lat},${ns.lng}`} target="_blank" rel="noreferrer" className="text-xs text-gold-400 hover:underline">Where the driver was when filing</a>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function ChatSheet({ job, onClose }: { job: JobForTools | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(job)} onClose={onClose} title="Chat with the customer">
      {job && (
        <div className="space-y-3">
          <p className="text-xs text-dark-400">Messages here reach the customer's tracking page and phone, and are seen by the driver and Elite BCN too.</p>
          <TripChat bookingId={job.id} placeholder="Message the customer…" />
        </div>
      )}
    </Sheet>
  );
}
