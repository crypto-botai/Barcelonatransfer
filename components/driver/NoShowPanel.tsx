"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, AlertTriangle, Check, MapPin } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Waiting timer and no-show evidence, shown once the driver has arrived.
 *
 * The timer runs from the driver's own Arrived tap, so the number the operator
 * later sees is the one the driver was watching. Photographs are taken at the
 * pickup point and filed with the driver's coordinates, which is what turns
 * "nobody was there" from one person's word against another's into something
 * that can actually be checked.
 */
export default function NoShowPanel({
  bookingId,
  arrivedAt,
  alreadyFiled = false,
}: {
  bookingId: string;
  /** When the driver tapped Arrived. The timer counts from here. */
  arrivedAt: string | Date;
  alreadyFiled?: boolean;
}) {
  const started = new Date(arrivedAt).getTime();
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - started));
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filing, setFiling] = useState(false);
  const [filed, setFiled] = useState(alreadyFiled);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.max(0, Date.now() - started)), 1000);
    return () => clearInterval(t);
  }, [started]);

  const mins = Math.floor(elapsed / 60_000);
  const secs = Math.floor((elapsed % 60_000) / 1000);
  // 60 minutes of free waiting is what the customer was promised; past that the
  // driver is giving away time and the operator should know.
  const overFree = mins >= 60;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 6) {
      toast.error("Up to 6 photos");
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "no-show");
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        uploaded.push(data.url);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function file() {
    if (images.length === 0) {
      toast.error("Take at least one photo first");
      return;
    }
    setFiling(true);
    try {
      // Position where the browser gives it up quickly; a slow fix must not
      // block filing, so this resolves without coordinates rather than hanging.
      const coords = await new Promise<{ lat?: number; lng?: number }>((resolve) => {
        if (!("geolocation" in navigator)) return resolve({});
        const timer = setTimeout(() => resolve({}), 4000);
        navigator.geolocation.getCurrentPosition(
          (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
          () => { clearTimeout(timer); resolve({}); },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
        );
      });

      const res = await fetch("/api/driver/no-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, images, note: note || undefined, ...coords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not file");
      setFiled(true);
      toast.success("No-show reported — the office has been notified");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not file");
    } finally {
      setFiling(false);
    }
  }

  if (filed) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
        <p className="text-emerald-300 text-xs font-medium flex items-center gap-2">
          <Check size={13} /> No-show reported. The office has your photos.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] p-3.5 space-y-3">
      {/* Waiting timer */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-dark-500">Waiting</p>
          <p className={`text-2xl font-semibold tabular-nums ${overFree ? "text-amber-400" : "text-white"}`}>
            {mins}:{String(secs).padStart(2, "0")}
          </p>
        </div>
        {overFree && (
          <span className="text-[11px] text-amber-400 text-right max-w-[9rem] leading-snug">
            Past the 60 minutes of free waiting
          </span>
        )}
      </div>

      {/* Evidence */}
      <div className="pt-1 border-t border-white/[0.06] space-y-2.5">
        <p className="text-[11px] text-dark-400 flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-amber-400" />
          Passenger not here? Photograph the pickup point before you leave.
        </p>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={src} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/[0.1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((x) => x !== src))}
                  aria-label="Remove photo"
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || images.length >= 6}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-dark-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-40"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            {images.length === 0 ? "Take photo" : `Add photo (${images.length}/6)`}
          </button>

          {images.length > 0 && (
            <button
              onClick={file}
              disabled={filing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-medium transition-colors disabled:opacity-40"
            >
              {filing ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
              Report no-show
            </button>
          )}
        </div>

        {images.length > 0 && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Anything worth recording — which door you waited at, whether you called…"
            rows={2}
            className="input-luxury w-full px-3 py-2 rounded-lg text-xs resize-none"
          />
        )}
      </div>
    </div>
  );
}
