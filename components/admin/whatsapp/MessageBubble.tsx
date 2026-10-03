"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCheck, ChevronDown, Clock, Copy, FileText, MapPin, Reply, SmilePlus, RotateCw } from "lucide-react";
import type { ChatMessage } from "@/lib/whatsapp-inbox";
import { clockTime, formatSpans, previewText } from "@/lib/whatsapp-ui";
import { cn } from "@/lib/utils";
import { QUICK_REACTIONS } from "./EmojiPicker";

/** A message waiting to be confirmed by the server: shown at once, so sending feels instant. */
export interface PendingMessage {
  tempId: string;
  text: string;
  at: string;
  state: "sending" | "failed";
  error?: string;
  /** What retry needs to resend it. */
  retry: () => void;
  replyTo?: ChatMessage["replyTo"];
  fileName?: string | null;
  kind?: "text" | "image" | "document";
  previewUrl?: string | null;
}

export function Ticks({ status, className }: { status: ChatMessage["status"] | "sending"; className?: string }) {
  if (status === "sending") return <Clock size={12} className={cn("text-dark-400", className)} aria-label="Sending" />;
  if (status === "failed") return <AlertTriangle size={12} className={cn("text-red-400", className)} aria-label="Not delivered" />;
  if (status === "read") return <CheckCheck size={14} className={cn("text-sky-400", className)} aria-label="Read" />;
  if (status === "delivered") return <CheckCheck size={14} className={cn("text-dark-300", className)} aria-label="Delivered" />;
  return <Check size={14} className={cn("text-dark-300", className)} aria-label="Sent" />;
}

/** The words of a message: links open safely, and WhatsApp's *bold* _italic_ ~strike~ are drawn. */
export function MessageText({ text }: { text: string }) {
  return (
    <>
      {formatSpans(text).map((s, i) => {
        switch (s.kind) {
          case "link":
            return <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:decoration-sky-300">{s.text}</a>;
          case "bold": return <strong key={i} className="font-semibold">{s.text}</strong>;
          case "italic": return <em key={i}>{s.text}</em>;
          case "strike": return <s key={i}>{s.text}</s>;
          default: return <span key={i}>{s.text}</span>;
        }
      })}
    </>
  );
}

const mediaUrl = (id: string) => `/api/admin/whatsapp/media/${id}`;

/** The picture, player or file card for a message that carries one. */
function Attachment({ m, onOpenImage }: { m: Pick<ChatMessage, "type" | "mediaId" | "fileName" | "text">; onOpenImage: (src: string) => void }) {
  const [broken, setBroken] = useState(false);
  if (m.type === "location") {
    const url = m.text.match(/https?:\/\/\S+/)?.[0];
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2.5 text-sm text-sky-300 hover:bg-black/35">
        <MapPin size={16} /> Open location in Maps
      </a>
    ) : null;
  }
  if (!m.mediaId) return null;
  const src = mediaUrl(m.mediaId);
  if (broken) {
    return <p className="mb-1 rounded-lg bg-black/25 px-3 py-2 text-xs text-dark-400">This file is no longer available from WhatsApp.</p>;
  }
  if (m.type === "image" || m.type === "sticker") {
    return (
      <button type="button" onClick={() => onOpenImage(src)} className="mb-1 block overflow-hidden rounded-lg" aria-label="Open photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Photo in the conversation" loading="lazy" onError={() => setBroken(true)} className={cn("block rounded-lg object-cover", m.type === "sticker" ? "h-32 w-32 object-contain" : "max-h-72 w-full min-w-[12rem]")} />
      </button>
    );
  }
  if (m.type === "audio") {
    return <audio controls preload="none" src={src} onError={() => setBroken(true)} className="mb-1 h-10 w-60 max-w-full" />;
  }
  if (m.type === "video") {
    return <video controls preload="metadata" src={src} onError={() => setBroken(true)} className="mb-1 max-h-72 w-full rounded-lg" />;
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="mb-1 flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2.5 hover:bg-black/35">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-500/15 text-gold-300"><FileText size={20} /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-white">{m.fileName ?? "Document"}</span>
        <span className="text-[11px] text-dark-400">Tap to open</span>
      </span>
    </a>
  );
}

/** What is written under the attachment: the caption, or nothing when the text is only the file's label. */
function bodyText(m: Pick<ChatMessage, "type" | "text" | "fileName">): string {
  if (m.type === "text" || m.type === "interactive" || m.type === "button") return m.text;
  if (m.type === "location") return m.text.replace(/^\[location\]\s*/, "").replace(/https?:\/\/\S+/, "").trim();
  const caption = m.text.replace(/^\[[a-z ]+\]\s*/i, "").trim();
  return caption === m.fileName ? "" : caption;
}

export interface BubbleProps {
  m: ChatMessage;
  customerName: string;
  /** First of a run from the same sender: gets the tail and a little more air above. */
  first: boolean;
  highlighted: boolean;
  onReply: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onJumpTo: (wamid: string) => void;
  onOpenImage: (src: string) => void;
  canReact: boolean;
}

function BubbleBase({ m, customerName, first, highlighted, onReply, onReact, onJumpTo, onOpenImage, canReact }: BubbleProps) {
  const out = m.dir === "out";
  const [menu, setMenu] = useState<null | "actions" | "react">(null);
  const wrap = useRef<HTMLDivElement>(null);
  const text = bodyText(m);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : wrap.current && !wrap.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);

  const mine = m.reactions.find((r) => r.dir === "out")?.emoji;

  return (
    <div id={`wa-${m.wamid}`} className={cn("group flex", out ? "justify-end" : "justify-start", first ? "mt-2.5" : "mt-0.5")}>
      <div ref={wrap} className={cn("relative max-w-[85%] sm:max-w-[68%]", m.reactions.length > 0 && "mb-3")}>
        <div
          className={cn(
            "relative rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-[1.4] shadow-sm transition-shadow",
            out ? "bg-[#2e2711] text-[#f4ecd6]" : "bg-[#1c1c1c] text-dark-100",
            first && (out
              ? "rounded-tr-none before:absolute before:-right-1.5 before:top-0 before:h-3 before:w-2 before:bg-[#2e2711] before:[clip-path:polygon(0_0,100%_0,0_100%)]"
              : "rounded-tl-none before:absolute before:-left-1.5 before:top-0 before:h-3 before:w-2 before:bg-[#1c1c1c] before:[clip-path:polygon(100%_0,0_0,100%_100%)]"),
            highlighted && "ring-2 ring-gold-400/70",
          )}
        >
          {/* The sender's name, for the office's own messages sent by someone specific. */}
          {out && m.by && m.by !== "Office" && first && <p className="mb-0.5 text-[11px] font-medium text-gold-400">{m.by}</p>}

          {m.replyTo && (
            <button
              type="button"
              onClick={() => onJumpTo(m.replyTo!.wamid)}
              className={cn("mb-1 block w-full rounded-md border-l-4 bg-black/25 px-2.5 py-1.5 text-left", m.replyTo.dir === "out" ? "border-gold-400" : "border-sky-400")}
            >
              <span className={cn("block text-[11.5px] font-medium", m.replyTo.dir === "out" ? "text-gold-300" : "text-sky-300")}>
                {m.replyTo.dir === "out" ? "You" : customerName}
              </span>
              <span className="line-clamp-2 text-[12.5px] text-dark-300">{m.replyTo.text ? previewText(m.replyTo.type, m.replyTo.text) : "Original message"}</span>
            </button>
          )}

          <Attachment m={m} onOpenImage={onOpenImage} />

          {text && (
            <p className="whitespace-pre-wrap break-words">
              <MessageText text={text} />
              {/* Reserves the corner the time sits in, so text never runs underneath it. */}
              <span className="inline-block w-[4.25rem]" aria-hidden="true" />
            </p>
          )}

          <span className={cn("flex items-center justify-end gap-1 text-[10.5px] tabular-nums text-dark-400", text ? "float-right -mb-0.5 -mt-3.5" : "mt-0.5")}>
            {clockTime(m.at)}
            {out && <Ticks status={m.status} />}
          </span>
          {text && <span className="clear-both block" />}

          {/* The ⋯ button: reply, react, copy. Visible on hover, and always on touch screens. */}
          <button
            type="button"
            aria-label="Message options"
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            onClick={() => setMenu(menu ? null : "actions")}
            className={cn(
              "absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-dark-200 opacity-0 backdrop-blur transition-opacity focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70",
              menu && "opacity-100",
            )}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {m.reactions.length > 0 && (
          <div className={cn("absolute -bottom-3.5 flex rounded-full border border-white/10 bg-[#1f1f1f] px-1.5 py-0.5 text-[13px] shadow", out ? "right-3" : "left-3")} aria-label={`Reactions: ${m.reactions.map((r) => r.emoji).join(" ")}`}>
            {m.reactions.map((r) => <span key={r.dir}>{r.emoji}</span>)}
          </div>
        )}

        {m.problem && (
          <p className="mt-1 text-right text-[11px] text-red-300">Not delivered: {m.problem}</p>
        )}

        {menu && (
          <div role="menu" className={cn("absolute top-8 z-20 min-w-[11rem] overflow-hidden rounded-xl border border-white/10 bg-[#161616] py-1 shadow-2xl shadow-black/60", out ? "right-0" : "left-0")}>
            {menu === "actions" ? (
              <>
                <button role="menuitem" type="button" onClick={() => { onReply(m); setMenu(null); }} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-dark-100 hover:bg-white/[0.06]">
                  <Reply size={15} /> Reply
                </button>
                {canReact && !out && (
                  <button role="menuitem" type="button" onClick={() => setMenu("react")} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-dark-100 hover:bg-white/[0.06]">
                    <SmilePlus size={15} /> React
                  </button>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { void navigator.clipboard?.writeText(text || m.text).catch(() => {}); setMenu(null); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-dark-100 hover:bg-white/[0.06]"
                >
                  <Copy size={15} /> Copy text
                </button>
              </>
            ) : (
              <div className="flex gap-0.5 p-1.5">
                {QUICK_REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="menuitem"
                    aria-label={`React ${e}`}
                    onClick={() => { onReact(m, mine === e ? "" : e); setMenu(null); }}
                    className={cn("grid h-9 w-9 place-items-center rounded-full text-xl transition-transform hover:scale-125 hover:bg-white/[0.08]", mine === e && "bg-gold-500/20")}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = memo(BubbleBase);

/** A message that has not been confirmed yet: sending, or failed with a way to try again. */
export function PendingBubble({ p, first }: { p: PendingMessage; first: boolean }) {
  return (
    <div className={cn("flex justify-end", first ? "mt-2.5" : "mt-0.5")}>
      <div className="max-w-[85%] sm:max-w-[68%]">
        <div className={cn("relative rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-[1.4]", p.state === "failed" ? "bg-red-950/50 text-red-100" : "bg-[#2e2711]/80 text-[#f4ecd6]/90")}>
          {p.previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.previewUrl} alt="Photo being sent" className="mb-1 max-h-60 w-full rounded-lg object-cover opacity-80" />
          )}
          {p.kind === "document" && p.fileName && (
            <p className="mb-1 flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-sm"><FileText size={16} /> <span className="truncate">{p.fileName}</span></p>
          )}
          {p.text && <p className="whitespace-pre-wrap break-words"><MessageText text={p.text} /></p>}
          <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[10.5px] tabular-nums text-dark-400">
            {clockTime(p.at)}
            <Ticks status={p.state === "failed" ? "failed" : "sending"} />
          </span>
        </div>
        {p.state === "failed" && (
          <div className="mt-1 flex items-center justify-end gap-3 text-[11.5px]">
            <span className="text-red-300">{p.error ?? "Not sent"}</span>
            <button type="button" onClick={p.retry} className="inline-flex items-center gap-1 font-medium text-gold-300 hover:text-gold-200">
              <RotateCw size={12} /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
