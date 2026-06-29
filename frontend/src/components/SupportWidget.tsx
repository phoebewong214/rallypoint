import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../rally-shared";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supportApi, type SupportTurn } from "../api/support";
import { ApiError } from "../api/client";

const GREETING =
  "Hi! I'm the RallyPoint assistant. Ask me anything about finding partners, scheduling games, or your profile. Need a person? Tap “Talk to a human”.";

/* Floating support assistant — bottom-right launcher + chat panel. Only rendered
 * for signed-in users (the support endpoints require auth). Degrades gracefully:
 * if no AI is configured server-side, the assistant steers users to the
 * email-a-human escalation, which always works. */
export const SupportWidget: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  if (!isAuthenticated) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const prior = messages;
    setMessages([...prior, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const { reply } = await supportApi.chat(text, prior);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't reach support", "error");
    } finally {
      setSending(false);
    }
  };

  const escalate = async () => {
    if (escalating) return;
    const typed = input.trim();
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const message = typed || lastUser?.content || "I'd like to talk to a human.";
    setEscalating(true);
    try {
      await supportApi.escalate(message, messages);
      if (typed) setInput("");
      setMessages((m) => [
        ...m,
        ...(typed ? [{ role: "user" as const, content: typed }] : []),
        {
          role: "assistant",
          content: `Thanks — I've sent this to our team. We'll reply to ${user?.email ?? "your email"} soon.`,
        },
      ]);
    } catch (e) {
      show(e instanceof ApiError ? e.message : "Couldn't send your message", "error");
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div style={wrap}>
      {open && (
        <div style={panel} role="dialog" aria-label="Support assistant">
          <div style={head}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="sparkles" size={16} />
              <strong>Support</strong>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={iconBtn}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div ref={scrollRef} style={body}>
            <Bubble role="assistant" text={GREETING} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.content} />
            ))}
            {sending && <Bubble role="assistant" text="…" />}
          </div>

          <div style={foot}>
            <button
              type="button"
              onClick={escalate}
              disabled={escalating}
              style={humanBtn}
              title="Email the support team"
            >
              <Icon name="mail" size={13} /> {escalating ? "Sending…" : "Talk to a human"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Type your question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <button type="button" className="btn-primary" onClick={send} disabled={sending || !input.trim()} aria-label="Send">
                <Icon name="send" size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={launcher}
        aria-label={open ? "Close support" : "Open support"}
      >
        <Icon name={open ? "x" : "message"} size={22} />
      </button>
    </div>
  );
};

const Bubble: React.FC<{ role: "user" | "assistant"; text: string }> = ({ role, text }) => (
  <div style={{ display: "flex", justifyContent: role === "user" ? "flex-end" : "flex-start" }}>
    <div
      style={{
        maxWidth: "82%",
        padding: "9px 12px",
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        background: role === "user" ? "var(--green)" : "var(--bg-2, rgba(127,127,127,0.12))",
        color: role === "user" ? "var(--green-ink, #06281a)" : "var(--text)",
        borderBottomRightRadius: role === "user" ? 4 : 14,
        borderBottomLeftRadius: role === "user" ? 14 : 4,
      }}
    >
      {text}
    </div>
  </div>
);

/* ---- styles ---- */
const wrap: React.CSSProperties = { position: "fixed", right: 20, bottom: 20, zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 };
const launcher: React.CSSProperties = {
  width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
  background: "var(--green)", color: "var(--green-ink, #06281a)",
  display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
};
const panel: React.CSSProperties = {
  width: 360, maxWidth: "calc(100vw - 40px)", height: 480, maxHeight: "calc(100vh - 120px)",
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16,
  display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
};
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border)" };
const body: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 };
const foot: React.CSSProperties = { padding: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 };
const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "grid", placeItems: "center", padding: 4 };
const humanBtn: React.CSSProperties = {
  alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6,
  background: "none", border: "1px solid var(--border)", borderRadius: 999,
  padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
};

export default SupportWidget;
