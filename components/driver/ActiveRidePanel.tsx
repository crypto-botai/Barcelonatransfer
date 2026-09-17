"use client";

import { useEffect, useState } from "react";
import { Copy, MessageSquare, Navigation } from "lucide-react";
import toast from "react-hot-toast";
import type { RideStage } from "@prisma/client";
import RideStageControl from "@/components/driver/RideStageControl";
import TripChat from "@/components/chat/TripChat";
import { navUrl, readNavPref, saveNavPref, freeWaitMinutes, type NavApp } from "@/lib/nav-links";
import { formatCurrency } from "@/lib/utils";

/**
 * The chauffeur's controls for one journey, in the order the journey runs.
 *
 *   Start trip        opens navigation to the pick-up and tells the customer
 *   Arrived           starts the waiting clock, against the free allowance
 *   Passenger on board  opens navigation to the drop-off
 *   Ride completed    closes the job and adds the fare to their earnings
 *
 * Both addresses have a copy button and an open-in-maps button of their own,
 * because a driver often wants the address in WhatsApp or a different app.
 */
export default function ActiveRidePanel({
  booking, onStageChange,
}: {
  booking: {
    id: string; confirmationCode: string;
    pickupAddress: string; dropoffAddress: string;
    pickupLat?: number | null; pickupLng?: number | null;
    dropoffLat?: number | null; dropoffLng?: number | null;
    flightNumber?: string | null;
    rideStage?: RideStage | null; rideStageAt?: Date | string | null; arrivedAt?: Date | string | null;
    driverAmount: number | null;
  };
  onStageChange: (stage: RideStage) => void;
}) {
  const [app, setApp] = useState<NavApp>("google");
  const [chat, setChat] = useState(false);
  useEffect(() => { setApp(readNavPref()); }, []);

  const pickupNav  = navUrl(app, booking.pickupAddress, booking.pickupLat, booking.pickupLng);
  const dropoffNav = navUrl(app, booking.dropoffAddress, booking.dropoffLat, booking.dropoffLng);

  function chooseApp(a: NavApp) { setApp(a); saveNavPref(a); }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast.success("Address copied"); }
    catch { toast.error("Could not copy"); }
  }

  const stage = booking.rideStage ?? null;
  const waitingFrom = booking.arrivedAt ?? (stage === "ARRIVED" || stage === "WAITING_PASSENGER" ? booking.rideStageAt : null);

  return (
    <div className="space-y-3">
      {/* Navigation app, chosen once and remembered. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-dark-500">Navigate with</span>
        {(["google", "waze"] as NavApp[]).map((a) => (
          <button key={a} type="button" onClick={() => chooseApp(a)} className={`h-8 rounded-lg border px-3 transition-colors ${app === a ? "border-gold-500/60 bg-gold-500/10 text-gold-300" : "border-white/[0.1] text-dark-400 hover:text-white"}`}>
            {a === "google" ? "Google Maps" : "Waze"}
          </button>
        ))}
      </div>

      <AddressRow label="Pick-up" address={booking.pickupAddress} nav={pickupNav} onCopy={() => copy(booking.pickupAddress)} active={!stage || stage === "ON_THE_WAY" || stage === "ARRIVED" || stage === "WAITING_PASSENGER"} />
      <AddressRow label="Drop-off" address={booking.dropoffAddress} nav={dropoffNav} onCopy={() => copy(booking.dropoffAddress)} active={stage === "ON_BOARD"} />

      {waitingFrom && stage !== "ON_BOARD" && stage !== "COMPLETED" && (
        <WaitTimer since={waitingFrom} freeMin={freeWaitMinutes(Boolean(booking.flightNumber))} />
      )}

      <RideStageControl
        bookingId={booking.id}
        currentStage={stage}
        navFor={(s) => (s === "ON_THE_WAY" ? pickupNav : s === "ON_BOARD" ? dropoffNav : null)}
        onAdvance={(s) => {
          if (s === "COMPLETED" && booking.driverAmount != null) {
            toast.success(`Ride complete. ${formatCurrency(booking.driverAmount)} added to your earnings.`, { duration: 6000 });
          }
          onStageChange(s);
        }}
      />

      <div>
        <button type="button" onClick={() => setChat((c) => !c)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs text-dark-200 hover:border-white/20 hover:text-white">
          <MessageSquare size={13} /> {chat ? "Hide chat" : "Chat with customer"}
        </button>
        {chat && <div className="mt-2"><TripChat bookingId={booking.id} compact placeholder="Message the customer…" /></div>}
      </div>
    </div>
  );
}

function AddressRow({ label, address, nav, onCopy, active }: { label: string; address: string; nav: string; onCopy: () => void; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${active ? "border-gold-500/30 bg-gold-500/[0.05]" : "border-white/[0.06]"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-dark-500">{label}</p>
        <p className="truncate text-sm text-white">{address}</p>
      </div>
      <button type="button" onClick={onCopy} aria-label={`Copy ${label} address`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-dark-300 hover:text-white">
        <Copy size={14} />
      </button>
      <a href={nav} target="_blank" rel="noreferrer" aria-label={`Navigate to ${label}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 hover:bg-gold-500/20">
        <Navigation size={14} />
      </a>
    </div>
  );
}

/** Minutes and seconds since the chauffeur arrived, against the free allowance. */
function WaitTimer({ since, freeMin }: { since: Date | string; freeMin: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const m = Math.floor(secs / 60), s = secs % 60;
  const over = m >= freeMin;
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${over ? "border-amber-500/40 bg-amber-500/10" : "border-white/[0.08] bg-white/[0.02]"}`} aria-live="off">
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-dark-500">Waiting</p>
        <p className={`font-display text-2xl tabular-nums ${over ? "text-amber-300" : "text-white"}`}>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</p>
      </div>
      <p className="max-w-[12rem] text-right text-xs text-dark-400">
        {over ? <><span className="text-amber-300">Past the {freeMin} min included.</span> If nobody comes, file a no-show below.</> : <>{freeMin} min waiting is included{freeMin === 60 ? " on airport pick-ups" : ""}.</>}
      </p>
    </div>
  );
}

