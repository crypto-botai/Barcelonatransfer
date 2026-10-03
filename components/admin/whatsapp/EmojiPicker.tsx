"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A compact emoji picker with no dependency.
 *
 * A library for this would add a hundred kilobytes to a page the office keeps
 * open all day, to offer thousands of emoji of which a handful are ever used in
 * a transfer business. These cover greetings, thanks, travel and the usual
 * reactions.
 */

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "👌"] as const;

const GROUPS: { label: string; icon: string; emoji: string[] }[] = [
  { label: "Smileys", icon: "😀", emoji: ["😀", "😃", "😄", "😁", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤩", "🤗", "🤔", "😅", "😂", "🙃", "😌", "😇", "🥳", "😴", "😮", "😢", "😬"] },
  { label: "Gestures", icon: "👍", emoji: ["👍", "👎", "👌", "🤝", "🙏", "👏", "🙌", "💪", "✌️", "🤞", "👋", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "✨", "🎉", "🔥", "⭐", "💯"] },
  { label: "Travel", icon: "✈️", emoji: ["✈️", "🛬", "🛫", "🚗", "🚕", "🚙", "🚐", "🚌", "🚆", "🚢", "🧳", "🗺️", "📍", "🏨", "🏖️", "🌅", "🌊", "⛰️", "🏰", "🍷", "🍽️", "☀️", "🌤️", "🌙"] },
  { label: "Symbols", icon: "✅", emoji: ["✅", "☑️", "❌", "⚠️", "ℹ️", "❓", "❗", "⏰", "🕐", "📅", "📞", "📱", "💬", "📧", "💳", "💶", "🧾", "🔑", "🔔", "➡️", "⬅️", "⬆️", "⬇️", "🆗"] },
];

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape or on a click anywhere else.
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji"
      className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl shadow-black/60"
    >
      <div className="flex border-b border-white/[0.06]" role="tablist">
        {GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            role="tab"
            aria-selected={tab === i}
            aria-label={g.label}
            onClick={() => setTab(i)}
            className={`flex-1 py-2.5 text-lg transition-colors ${tab === i ? "bg-gold-500/10" : "hover:bg-white/[0.04]"}`}
          >
            {g.icon}
          </button>
        ))}
      </div>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2" role="tabpanel">
        {GROUPS[tab].emoji.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="grid h-9 place-items-center rounded-lg text-xl transition-transform hover:scale-110 hover:bg-white/[0.07]"
            aria-label={e}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
