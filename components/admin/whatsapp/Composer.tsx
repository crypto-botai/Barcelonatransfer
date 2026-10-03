"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FileText, Image as ImageIcon, LayoutList, ShoppingBag, Loader2, Paperclip, Send, Smile, X, Zap } from "lucide-react";
import type { ChatMessage } from "@/lib/whatsapp-inbox";
import type { QuickReply } from "@/lib/whatsapp-settings";
import type { ResolvedService } from "@/lib/whatsapp-services";
import { fileProblem } from "@/lib/whatsapp-files";
import { matchQuickReplies, previewText } from "@/lib/whatsapp-ui";
import { cn } from "@/lib/utils";
import EmojiPicker from "./EmojiPicker";

export interface ComposerHandle {
  /** Attach a file from outside, for drag and drop. Returns the reason if it cannot be sent. */
  attach: (file: File) => string | null;
  focus: () => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSendText: (text: string) => void;
  onSendFile: (file: File, caption: string) => void;
  onSendMenu: () => void;
  onSendCatalog: () => void;
  onSendService: (id: string) => void;
  onCancelReply: () => void;
  onError: (message: string) => void;
  replyingTo: ChatMessage | null;
  customerName: string;
  quickReplies: QuickReply[];
  services: ResolvedService[];
  busy: boolean;
}

type Popup = null | "emoji" | "attach" | "services";

const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { value, onChange, onSendText, onSendFile, onSendMenu, onSendCatalog, onSendService, onCancelReply, onError, replyingTo, customerName, quickReplies, services, busy },
  ref,
) {
  const [popup, setPopup] = useState<Popup>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pick, setPick] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => matchQuickReplies(value, quickReplies), [value, quickReplies]);
  useEffect(() => setPick(0), [value]);

  // Grow with the text, to a limit, like WhatsApp's own box.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    // A scrollbar only when the text is taller than the box; otherwise a sliver of one shows at the edge.
    el.style.overflowY = el.scrollHeight > 140 ? "auto" : "hidden";
  }, [value]);

  // A preview URL is a handle to memory. Release it when it is replaced or the box goes away.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const attach = useCallback((f: File): string | null => {
    const problem = fileProblem(f);
    if (problem) return problem;
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    setPopup(null);
    area.current?.focus();
    return null;
  }, []);

  const clearFile = useCallback(() => { setFile(null); setPreview(null); }, []);

  useImperativeHandle(ref, () => ({ attach, focus: () => area.current?.focus() }), [attach]);

  // A click outside closes the attach and services menus.
  useEffect(() => {
    if (popup !== "attach" && popup !== "services") return;
    const down = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setPopup(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPopup(null); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [popup]);

  const canSend = !busy && (file !== null || value.trim().length > 0);

  const submit = useCallback(() => {
    if (!canSend) return;
    if (file) {
      onSendFile(file, value.trim());
      clearFile();
      onChange("");
    } else {
      onSendText(value.trim());
      onChange("");
    }
  }, [canSend, file, value, onSendFile, onSendText, onChange, clearFile]);

  const insert = (text: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  };

  const applyReply = (r: QuickReply) => { onChange(r.text); setPopup(null); area.current?.focus(); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // The browser is still composing a character (an accent, a CJK word): Enter belongs to that, not to us.
    if (e.nativeEvent.isComposing) return;
    if (matches && matches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setPick((p) => (p + 1) % matches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setPick((p) => (p - 1 + matches.length) % matches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyReply(matches[pick]); return; }
      if (e.key === "Escape") { e.preventDefault(); onChange(""); return; }
    }
    if (e.key === "Escape" && replyingTo) { onCancelReply(); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files)[0];
    if (!f) return;
    e.preventDefault();
    const problem = attach(f);
    if (problem) onError(problem);
  };

  const chosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const problem = attach(f);
    if (problem) onError(problem);
  };

  const enabledServices = services.filter((s) => s.enabled);

  return (
    <div ref={bar} className="relative border-t border-white/[0.06] bg-[#0f0f0f] px-2.5 py-2 sm:px-3">
      {replyingTo && (
        <div className="mb-2 flex items-stretch gap-2 rounded-lg bg-black/30 p-1.5">
          <div className={cn("min-w-0 flex-1 rounded-md border-l-4 bg-white/[0.04] px-2.5 py-1.5", replyingTo.dir === "out" ? "border-gold-400" : "border-sky-400")}>
            <p className={cn("text-[11.5px] font-medium", replyingTo.dir === "out" ? "text-gold-300" : "text-sky-300")}>{replyingTo.dir === "out" ? "You" : customerName}</p>
            <p className="truncate text-[12.5px] text-dark-300">{previewText(replyingTo.type, replyingTo.text)}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full text-dark-400 hover:bg-white/[0.06] hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-black/30 p-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Photo ready to send" className="h-14 w-14 rounded-md object-cover" />
          ) : (
            <span className="grid h-14 w-14 place-items-center rounded-md bg-gold-500/15 text-gold-300"><FileText size={24} /></span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white">{file.name}</p>
            <p className="text-[11.5px] text-dark-400">{(file.size / 1024).toFixed(file.size > 1024 * 100 ? 0 : 1)} KB · add a caption below, then send</p>
          </div>
          <button type="button" onClick={clearFile} aria-label="Remove file" className="grid h-8 w-8 place-items-center rounded-full text-dark-400 hover:bg-white/[0.06] hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {matches && (
        <div role="listbox" aria-label="Saved replies" className="absolute bottom-full left-2 right-2 z-30 mb-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#161616] py-1 shadow-2xl shadow-black/60 sm:left-3 sm:right-auto sm:w-[26rem]">
          {matches.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-dark-400">No saved reply starts with that. Add some in WhatsApp settings.</p>
          ) : (
            matches.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === pick}
                onMouseEnter={() => setPick(i)}
                onClick={() => applyReply(r)}
                className={cn("block w-full px-3.5 py-2 text-left", i === pick ? "bg-gold-500/10" : "hover:bg-white/[0.04]")}
              >
                <span className="text-[12.5px] font-medium text-gold-300">/{r.shortcut}</span>
                <span className="line-clamp-2 text-[13px] text-dark-200">{r.text}</span>
              </button>
            ))
          )}
        </div>
      )}

      {popup === "attach" && (
        <div role="menu" className="absolute bottom-full left-2 z-30 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#161616] py-1 shadow-2xl shadow-black/60 sm:left-14">
          <button role="menuitem" type="button" onClick={() => photoInput.current?.click()} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-dark-100 hover:bg-white/[0.06]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/15 text-sky-300"><ImageIcon size={16} /></span> Photo
          </button>
          <button role="menuitem" type="button" onClick={() => docInput.current?.click()} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-dark-100 hover:bg-white/[0.06]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gold-500/15 text-gold-300"><FileText size={16} /></span> Document
          </button>
          <button role="menuitem" type="button" onClick={() => setPopup("services")} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-dark-100 hover:bg-white/[0.06] sm:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><LayoutList size={16} /></span> Services and prices
          </button>
          <button role="menuitem" type="button" onClick={() => { setPopup(null); onChange("/"); area.current?.focus(); }} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-dark-100 hover:bg-white/[0.06] sm:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/15 text-violet-300"><Zap size={16} /></span> Saved replies
          </button>
        </div>
      )}

      {popup === "services" && (
        <div role="menu" className="absolute bottom-full left-2 z-30 mb-2 w-[min(19rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/10 bg-[#161616] shadow-2xl shadow-black/60 sm:left-24">
          <button role="menuitem" type="button" onClick={() => { setPopup(null); onSendMenu(); }} disabled={enabledServices.length === 0} className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 text-left hover:bg-white/[0.06] disabled:opacity-40">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><LayoutList size={16} /></span>
            <span>
              <span className="block text-sm font-medium text-white">Send the services menu</span>
              <span className="block text-[11.5px] text-dark-400">A tap-to-choose list. The customer picks, we send the price and a Book button.</span>
            </span>
          </button>
          <button role="menuitem" type="button" onClick={() => { setPopup(null); onSendCatalog(); }} disabled={enabledServices.length === 0} className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 text-left hover:bg-white/[0.06] disabled:opacity-40">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300"><ShoppingBag size={16} /></span>
            <span>
              <span className="block text-sm font-medium text-white">Send the catalogue</span>
              <span className="block text-[11.5px] text-dark-400">Opens the shop inside the chat, with every service and its price.</span>
            </span>
          </button>
          <p className="px-3.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-dark-500">Or send one service</p>
          <div className="max-h-56 overflow-y-auto pb-1">
            {enabledServices.map((s) => (
              <button key={s.id} role="menuitem" type="button" onClick={() => { setPopup(null); onSendService(s.id); }} className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-white/[0.06]">
                <span className="truncate text-dark-100">{s.title}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-gold-300">{s.fromPrice ? `from €${s.fromPrice}${s.unit === "hour" ? "/h" : ""}` : "—"}</span>
              </button>
            ))}
            {enabledServices.length === 0 && <p className="px-3.5 py-3 text-sm text-dark-400">No services are switched on.</p>}
          </div>
        </div>
      )}

      <div className="flex items-end gap-1">
        <div className="relative">
          <IconButton label="Emoji" active={popup === "emoji"} onClick={() => setPopup(popup === "emoji" ? null : "emoji")}><Smile size={21} /></IconButton>
          {popup === "emoji" && <EmojiPicker onPick={(e) => insert(e)} onClose={() => setPopup(null)} />}
        </div>

        <div className="relative">
          <IconButton label="Attach a photo or document" active={popup === "attach"} onClick={() => setPopup(popup === "attach" ? null : "attach")}><Paperclip size={20} /></IconButton>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={chosen} tabIndex={-1} />
          <input ref={docInput} type="file" accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={chosen} tabIndex={-1} />
        </div>

        {/* Services and saved replies get their own buttons from the small breakpoint up; on a phone they live in the attach menu. */}
        <div className="hidden sm:block">
          <IconButton label="Services and prices" active={popup === "services"} onClick={() => setPopup(popup === "services" ? null : "services")}><LayoutList size={20} /></IconButton>
        </div>

        <div className="hidden sm:block">
          <IconButton label="Saved replies. Or type a slash." active={matches !== null} onClick={() => { onChange(matches ? "" : "/"); area.current?.focus(); }}><Zap size={20} /></IconButton>
        </div>

        <label htmlFor="wa-reply" className="sr-only">Message</label>
        <textarea
          id="wa-reply"
          ref={area}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          maxLength={4000}
          placeholder={file ? "Add a caption" : "Type a message"}
          className="mx-1 max-h-36 min-h-[42px] flex-1 resize-none rounded-[1.25rem] border border-white/[0.08] bg-[#1a1a1a] px-4 py-[10px] text-[15px] leading-[1.4] text-white placeholder:text-dark-500 focus:border-gold-500/50 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-gold-500 text-black transition hover:bg-gold-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-dark-500"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="translate-x-px" />}
        </button>
      </div>
    </div>
  );
});

function IconButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("grid h-[42px] w-9 place-items-center rounded-full text-dark-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500/60", active && "text-gold-300")}
    >
      {children}
    </button>
  );
}

export default Composer;
