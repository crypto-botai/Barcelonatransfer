"use client";

import { useEffect, useRef } from "react";

/**
 * Watches for new WhatsApp messages on every admin page.
 *
 * It does four things, none of which need the inbox to be open:
 *   - keeps the unread count in the sidebar (via a window event)
 *   - puts the count in the browser tab title
 *   - plays a soft chime when a new message arrives
 *   - shows a desktop notification, when the admin has allowed them and the
 *     background push has not already shown one
 *
 * Nothing is shown for a chat the admin is looking at right now. The first
 * answer after the page loads only sets the baseline, so opening the panel
 * with ten old unread messages does not play ten chimes.
 */

export const UNREAD_EVENT = "wa:unread";
export const ACTIVE_CHAT_KEY = "__waActivePhone";
export const SOUND_KEY = "wa:sound";

declare global {
  interface Window {
    [ACTIVE_CHAT_KEY]?: string | null;
    __waUnread?: number;
  }
}

type Summary = { unchanged?: boolean; rev: string; unread: number; chats: number; latest: { phone: string; name: string | null; text: string; at: string } | null };

const POLL_VISIBLE_MS = 8_000;
const POLL_HIDDEN_MS = 30_000;

/** Two short rising notes. Generated, so there is no sound file to host or to fail to load. */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [[880, 0], [1175, 0.13]].forEach(([freq, offset]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.25);
  });
}

export default function WhatsAppAlerts() {
  const rev = useRef<string | null>(null);
  const baseline = useRef<string | null>(null); // time of the newest message already accounted for
  const ready = useRef(false);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    // Browsers only allow sound after the person has interacted with the page.
    const unlock = () => {
      try {
        audio.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        void audio.current.resume();
      } catch { /* no audio: alerts still show */ }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const setBadge = (n: number) => {
      window.__waUnread = n;
      window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: n }));
      const base = document.title.replace(/^\(\d+\)\s/, "");
      document.title = n > 0 ? `(${n}) ${base}` : base;
    };

    async function alert(latest: NonNullable<Summary["latest"]>) {
      let soundOn = true;
      try { soundOn = localStorage.getItem(SOUND_KEY) !== "0"; } catch { /* default on */ }
      if (soundOn && audio.current && audio.current.state === "running") chime(audio.current);

      // The background push shows its own notification, and a second one is noise.
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (await reg?.pushManager.getSubscription()) return;
        const n = new Notification(latest.name ? `${latest.name} on WhatsApp` : `WhatsApp ${latest.phone}`, {
          body: latest.text.replace(/\s+/g, " ").slice(0, 140),
          icon: "/icon-192.png",
          tag: `wa:${latest.phone}`,
        });
        n.onclick = () => {
          window.focus();
          window.location.assign(`/admin/whatsapp?phone=${encodeURIComponent(latest.phone)}`);
          n.close();
        };
      } catch { /* notifications are a courtesy */ }
    }

    async function tick() {
      try {
        const res = await fetch(`/api/admin/whatsapp/summary${rev.current ? `?rev=${encodeURIComponent(rev.current)}` : ""}`, { cache: "no-store" });
        if (res.status === 401) return; // signed out: stop asking
        if (res.ok) {
          const s = (await res.json()) as Summary;
          if (!s.unchanged) {
            rev.current = s.rev;
            setBadge(s.unread);
            const latest = s.latest;
            if (latest && s.unread > 0) {
              const isNew = baseline.current === null ? false : latest.at > baseline.current;
              const watching =
                document.visibilityState === "visible" && document.hasFocus() && window[ACTIVE_CHAT_KEY] === latest.phone;
              if (ready.current && isNew && !watching) void alert(latest);
              if (baseline.current === null || latest.at > baseline.current) baseline.current = latest.at;
            } else if (baseline.current === null) {
              baseline.current = new Date(0).toISOString();
            }
            ready.current = true;
          }
        }
      } catch { /* offline: try again next time */ }
      if (!stopped) timer = window.setTimeout(tick, document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") { window.clearTimeout(timer); void tick(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}
