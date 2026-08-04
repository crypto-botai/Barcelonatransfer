"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, MessageCircle, Send, Loader2, ChevronDown,
  Phone, Sparkles, ExternalLink, LifeBuoy,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  escalate?: boolean;
}

type Tab = "home" | "ai" | "whatsapp";

// ── Constants ──────────────────────────────────────────────────────────────
const SESSION_KEY  = "elite_support_session";
const WA_URL       = "https://wa.me/34635383712?text=Hello%2C%20I%20need%20help%20with%20a%20luxury%20transfer.";
const WA_NUM       = "+34 635 383 712";

const SUGGESTED = [
  "How much is an airport transfer?",
  "What vehicles do you have?",
  "How do I book?",
  "Do you cover Sitges?",
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

function detectLanguage(): string {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.split("-")[0];
  return ["en","es","ca","fr","de","it","ru","ar","zh","pt"].includes(lang) ? lang : "en";
}

function renderMd(text: string) {
  // No inner capturing groups — avoids undefined entries from split()
  const parts = text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\n)/g)
    .filter((p): p is string => p !== undefined && p !== "");
  return parts.map((part, i) => {
    if (part === "\n") return <br key={i} />;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (lm) return (
      <a key={i} href={lm[2]} target="_blank" rel="noopener noreferrer"
        className="underline text-[#c9a84c] hover:text-[#d4b96a]">{lm[1]}</a>
    );
    return part;
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function SupportCenter() {
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<Tab>("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(0);
  const [aiError, setAiError] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const sessionId  = useRef(getSessionId());
  const language   = useRef(detectLanguage());

  // Greet on first AI open
  useEffect(() => {
    if (tab === "ai" && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hello! I'm the Élite BCN AI Concierge.\n\nAsk me anything — pricing, vehicles, booking, service areas, and more.",
      }]);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [tab, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (tab === "ai") bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  // Clear unread on open
  useEffect(() => { if (open) setUnread(0); }, [open]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setAiError(false);
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, messages: history, language: language.current }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              text?: string; done?: boolean; escalate?: boolean; error?: string;
            };
            if (parsed.text) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant")
                  return [...prev.slice(0, -1), { ...last, content: last.content + parsed.text }];
                return prev;
              });
            }
            if (parsed.done && parsed.escalate) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return last ? [...prev.slice(0, -1), { ...last, escalate: true }] : prev;
              });
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch { /* parse errors are expected on SSE chunk boundaries */ }
        }
      }
    } catch {
      setAiError(true);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "I'm having trouble connecting. Please try WhatsApp for immediate help.", escalate: true },
      ]);
    } finally {
      setLoading(false);
      if (!open) setUnread(n => n + 1);
    }
  }, [messages, loading, open]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  function openPanel() { setOpen(true); setTab("home"); }
  function closePanel() { setOpen(false); }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger Button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={open ? closePanel : openPanel}
        // The accessible name must contain the visible label ("Need Help?") or
        // voice-control users saying the on-screen text cannot activate it.
        aria-label={open ? "Close support" : "Need help? Open support centre"}
        className="fixed bottom-20 right-6 lg:bottom-6 z-50 flex items-center gap-2.5 px-4 rounded-full focus:outline-none transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          height: "3.25rem",
          background: open ? "#1a1a1a" : "linear-gradient(135deg,#c9a84c,#d4af5a)",
          boxShadow: open ? "0 4px 20px rgba(0,0,0,.5)" : "0 8px 32px rgba(201,168,76,.45)",
          color: open ? "#c9a84c" : "#000",
          border: open ? "1px solid rgba(201,168,76,.3)" : "none",
        }}
      >
        {open
          ? <X size={18} />
          : <><LifeBuoy size={18} /><span className="text-sm font-semibold tracking-wide">Need Help?</span></>
        }
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0a0a]">
            {unread}
          </span>
        )}
      </button>

      {/* ── Panel ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden shadow-2xl"
          style={{
            bottom: "6rem",
            right: "1rem",
            width: "min(92vw, 390px)",
            maxHeight: "min(85vh, 580px)",
            height: tab === "ai" ? "min(85vh, 580px)" : "auto",
            borderRadius: "1.25rem",
            background: "#0c0c0c",
            border: "1px solid rgba(255,255,255,.07)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[.07] flex-shrink-0"
            style={{ background: "rgba(255,255,255,.03)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,168,76,.15)", border: "1px solid rgba(201,168,76,.3)" }}>
              <LifeBuoy size={16} className="text-[#c9a84c]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-none">Élite BCN Support</p>
              <p className="text-white/40 text-xs mt-0.5">24/7 — AI Concierge &amp; WhatsApp</p>
            </div>
            <button type="button" onClick={closePanel}
              className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
              <X size={16} />
            </button>
          </div>

          {/* ── HOME ──────────────────────────────────────────────────── */}
          {tab === "home" && (
            <div className="p-4 space-y-3 overflow-y-auto">
              {/* AI option */}
              <button type="button" onClick={() => setTab("ai")}
                className="w-full text-left rounded-2xl p-4 transition-colors"
                style={{ background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.18)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(201,168,76,.15)" }}>
                    <Sparkles size={17} className="text-[#c9a84c]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold mb-0.5">AI Concierge</p>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Instant answers 24/7 — pricing, vehicles, routes, booking help.
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {["Pricing","Fleet","Booking","Routes"].map(t => (
                        <span key={t} className="text-[10px] text-[#c9a84c] border border-[#c9a84c]/25 rounded-full px-2 py-0.5">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronDown size={13} className="text-white/20 -rotate-90 mt-1.5 flex-shrink-0" />
                </div>
                <p className="mt-3 pt-2.5 border-t border-white/[.05] text-xs font-medium text-[#c9a84c] flex items-center gap-1.5">
                  <Sparkles size={10} /> Chat with AI →
                </p>
              </button>

              {/* WhatsApp option */}
              <button type="button" onClick={() => setTab("whatsapp")}
                className="w-full text-left rounded-2xl p-4 transition-colors"
                style={{ background: "rgba(37,211,102,.05)", border: "1px solid rgba(37,211,102,.18)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(37,211,102,.15)" }}>
                    <MessageCircle size={17} className="text-[#25D366]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold mb-0.5">WhatsApp Support</p>
                    <p className="text-white/45 text-xs leading-relaxed">
                      Speak directly with our team for bookings, quotes &amp; urgent requests.
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                      <span className="text-[10px] text-[#25D366]">Typically replies instantly</span>
                    </div>
                  </div>
                  <ChevronDown size={13} className="text-white/20 -rotate-90 mt-1.5 flex-shrink-0" />
                </div>
                <p className="mt-3 pt-2.5 border-t border-white/[.05] text-xs font-medium text-[#25D366] flex items-center gap-1.5">
                  <MessageCircle size={10} /> Open WhatsApp →
                </p>
              </button>

              <p className="text-white/20 text-[10px] text-center pt-1">Élite BCN Transfers · Licensed VTC Barcelona</p>
            </div>
          )}

          {/* ── WHATSAPP ─────────────────────────────────────────────── */}
          {tab === "whatsapp" && (
            <div className="flex flex-col overflow-y-auto">
              <button type="button" onClick={() => setTab("home")}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-4 pt-4 pb-1">
                <ChevronDown size={12} className="rotate-90" /> Back
              </button>
              <div className="px-4 pb-5 pt-3 space-y-3">
                <div className="rounded-2xl p-4"
                  style={{ background: "rgba(37,211,102,.08)", border: "1px solid rgba(37,211,102,.2)" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">Élite BCN Team</p>
                      <p className="text-[#25D366] text-xs flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
                        Online · Typically replies instantly
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.04)" }}>
                    <p className="text-white/60 text-sm leading-relaxed">
                      👋 Hello! How can we help you today?
                    </p>
                  </div>
                </div>

                <a href={WA_URL} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl text-white text-sm font-semibold bg-[#25D366] hover:bg-[#1ebe5c] transition-colors">
                  <MessageCircle size={16} /> Start WhatsApp Chat
                </a>

                <a href={`tel:${WA_NUM.replace(/\s/g,"")}`}
                  className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl text-white/60 text-sm hover:text-white transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,.08)" }}>
                  <Phone size={14} /> Call {WA_NUM}
                </a>
              </div>
            </div>
          )}

          {/* ── AI CHAT ──────────────────────────────────────────────── */}
          {tab === "ai" && (
            <>
              {/* Back */}
              <button type="button" onClick={() => setTab("home")}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors px-4 pt-3 pb-1 flex-shrink-0">
                <ChevronDown size={12} className="rotate-90" /> Back
              </button>

              {/* Error banner */}
              {aiError && (
                <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs flex-shrink-0"
                  style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)" }}>
                  <span className="text-red-400 flex-1">AI temporarily unavailable.</span>
                  <a href={WA_URL} target="_blank" rel="noreferrer"
                    className="text-[#25D366] underline whitespace-nowrap">WhatsApp →</a>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                        style={{ background: "rgba(201,168,76,.15)", border: "1px solid rgba(201,168,76,.25)" }}>
                        <Sparkles size={10} className="text-[#c9a84c]" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        m.role === "user" ? "text-black rounded-br-sm font-medium" : "text-white/90 rounded-bl-sm"
                      }`}
                      style={m.role === "user"
                        ? { background: "linear-gradient(135deg,#c9a84c,#d4af5a)" }
                        : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }
                      }
                    >
                      {m.role === "assistant" && m.content === "" && loading && i === messages.length - 1
                        ? (
                          <span className="flex gap-1 items-center h-4 px-1">
                            {[0,1,2].map(d => (
                              <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                                style={{ animationDelay: `${d * 150}ms` }} />
                            ))}
                          </span>
                        )
                        : renderMd(m.content)
                      }
                      {m.escalate && (
                        <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                          className="mt-2.5 flex items-center gap-1.5 text-xs text-[#25D366] hover:text-green-400 transition-colors border-t border-white/[.06] pt-2">
                          <ExternalLink size={10} /> Continue on WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} className="h-1" />
              </div>

              {/* Suggested questions */}
              {messages.filter(m => m.role === "user").length === 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
                  {SUGGESTED.map(q => (
                    <button key={q} type="button" onClick={() => send(q)}
                      className="text-[11px] text-[#c9a84c] rounded-full px-2.5 py-1 hover:bg-[#c9a84c]/10 transition-colors"
                      style={{ border: "1px solid rgba(201,168,76,.25)" }}>
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 py-3 border-t border-white/[.06] flex-shrink-0"
                style={{ background: "rgba(0,0,0,.3)" }}>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask anything…"
                    maxLength={2000}
                    disabled={loading}
                    className="flex-1 bg-transparent text-white text-sm placeholder-white/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => send(input)}
                    disabled={!input.trim() || loading}
                    aria-label="Send"
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
                    style={{ background: "linear-gradient(135deg,#c9a84c,#d4af5a)" }}
                  >
                    {loading ? <Loader2 size={12} className="animate-spin text-black" /> : <Send size={12} className="text-black" />}
                  </button>
                </div>
                <p className="text-white/15 text-[9px] text-center mt-1.5">AI Concierge · Not a booking confirmation</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
