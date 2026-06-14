"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, ChevronDown, ExternalLink, CreditCard, AlertCircle } from "lucide-react";

interface BookingInfo {
  id?: string;
  reference?: string;
  paymentUrl?: string;
  amount?: number;
  currency?: string;
  error?: string;
  whatsapp?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  escalate?: boolean;
  booking?: BookingInfo;
}

const SESSION_KEY = "elite_chat_session";

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
  return ["en", "es", "ca", "fr", "de", "it", "ru", "ar", "zh"].includes(lang) ? lang : "en";
}

const SUGGESTED = [
  "How much is an airport transfer?",
  "What vehicles do you have?",
  "How do I book?",
  "Do you offer child seats?",
];

function BookingCard({ booking }: { booking: BookingInfo }) {
  if (booking.error) {
    return (
      <div className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-300 text-xs font-medium">Booking not processed</p>
            <p className="text-red-400/80 text-[11px] mt-0.5">{booking.error}</p>
            {booking.whatsapp && (
              <a
                href={booking.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-xs text-green-400 hover:text-green-300"
              >
                <ExternalLink size={11} /> Contact us on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/5 p-3">
      <p className="text-[#c9a84c] text-xs font-semibold mb-1 flex items-center gap-1.5">
        <CreditCard size={12} /> Booking Created
      </p>
      {booking.reference && (
        <p className="text-white/60 text-[11px] mb-2">
          Ref: <span className="text-white/90 font-mono">{booking.reference}</span>
          {booking.amount != null && (
            <span className="ml-2">· Total: <strong className="text-white">{booking.currency ?? "EUR"} {booking.amount.toFixed(2)}</strong></span>
          )}
        </p>
      )}
      {booking.paymentUrl && (
        <a
          href={booking.paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#c9a84c] text-black text-xs font-semibold py-2 hover:bg-[#d4af5a] transition-colors"
        >
          <CreditCard size={12} /> Pay Securely Now
        </a>
      )}
      <p className="text-white/30 text-[10px] text-center mt-1.5">Secure payment · No card details shared in chat</p>
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [unread, setUnread]       = useState(0);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const sessionId                 = useRef(getSessionId());
  const language                  = useRef(detectLanguage());

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hello! 👋 I'm the Élite BCN AI assistant. How can I help you today?\n\nYou can ask me about pricing, our fleet, pickup locations, or I can help you book a transfer right now.",
      }]);
      inputRef.current?.focus();
    }
    if (open) setUnread(0);
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Only pass role/content to the API (strip display-only fields)
    const allMessages = [...messages, userMsg].map((m) => ({
      role:    m.role,
      content: m.content,
    }));

    // Placeholder assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          sessionId: sessionId.current,
          messages:  allMessages,
          language:  language.current,
        }),
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
          const raw = line.slice(6);
          try {
            const parsed = JSON.parse(raw) as {
              text?:    string;
              done?:    boolean;
              escalate?: boolean;
              error?:   string;
              booking?: BookingInfo;
            };

            if (parsed.text) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return [...prev.slice(0, -1), { ...last, content: last.content + parsed.text }];
                }
                return prev;
              });
            }

            if (parsed.done && parsed.escalate) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                return last ? [...prev.slice(0, -1), { ...last, escalate: true }] : prev;
              });
            }

            if (parsed.booking) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return [...prev.slice(0, -1), { ...last, booking: parsed.booking }];
                }
                // Append as new message if no active assistant message
                return [...prev, { role: "assistant", content: "", booking: parsed.booking }];
              });
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role:    "assistant",
          content: "Sorry, something went wrong. Please try WhatsApp: [+34 635 383 712](https://wa.me/34635383712)",
          escalate: true,
        },
      ]);
    } finally {
      setLoading(false);
      if (!open) setUnread((n) => n + 1);
    }
  }, [messages, loading, open]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // Simple markdown renderer (bold + links only)
  function renderContent(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\)|\n)/g);
    return parts.map((part, i) => {
      if (part === "\n") return <br key={i} />;
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="underline text-[#c9a84c] hover:text-[#d4af5a]">{linkMatch[1]}</a>;
      return part;
    });
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#c9a84c] text-black shadow-2xl flex items-center justify-center hover:bg-[#d4af5a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#c9a84c] focus:ring-offset-2"
        style={{ boxShadow: "0 8px 32px rgba(201,168,76,0.5)" }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col w-[min(92vw,380px)] h-[520px] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: "#0a0a0a" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08]" style={{ background: "#111" }}>
            <div className="w-9 h-9 rounded-full bg-[#c9a84c]/20 border border-[#c9a84c]/40 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={16} className="text-[#c9a84c]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-none">Élite BCN Assistant</p>
              <p className="text-green-400 text-xs mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online · Book &amp; pay in chat
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors p-1">
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#c9a84c] text-black rounded-br-sm"
                      : "bg-white/[0.06] text-white/90 rounded-bl-sm border border-white/[0.08]"
                  }`}
                >
                  {m.role === "assistant" && m.content === "" && loading && i === messages.length - 1 && !m.booking ? (
                    <span className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                      ))}
                    </span>
                  ) : (
                    renderContent(m.content)
                  )}
                  {m.escalate && !m.booking && (
                    <a
                      href="https://wa.me/34635383712"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                    >
                      <ExternalLink size={11} /> Chat on WhatsApp
                    </a>
                  )}
                  {m.booking && <BookingCard booking={m.booking} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions (only when no messages sent by user yet) */}
          {messages.filter((m) => m.role === "user").length === 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[11px] text-[#c9a84c] border border-[#c9a84c]/30 rounded-full px-2.5 py-1 hover:bg-[#c9a84c]/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/[0.08]" style={{ background: "#0d0d0d" }}>
            <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type your message…"
                maxLength={2000}
                disabled={loading}
                className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="w-7 h-7 rounded-lg bg-[#c9a84c] text-black flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#d4af5a] transition-colors"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
            <p className="text-white/15 text-[10px] text-center mt-1.5">Secure payment via SumUp · Never share card details in chat</p>
          </div>
        </div>
      )}
    </>
  );
}
