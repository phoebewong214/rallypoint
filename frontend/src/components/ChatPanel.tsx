import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../rally-shared";
import { useChatMessages, useSendChatMessage } from "../hooks/useChat";

/* "3:07 PM" for today's messages, "Aug 9, 3:07 PM" for older ones. */
function timeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (d.toDateString() === new Date().toDateString()) return time;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
  } catch {
    return "";
  }
}

/* The chat thread for one confirmed game, embedded under its session card.
   Messages arrive through ['chat', inviteId] (invalidated by the SSE `chat`
   nudge — see useInviteStream), so both players see new messages without a
   refresh. Sending refetches after the server confirms; no optimistic echo. */
export function ChatPanel({ inviteId, opp }: { inviteId: number; opp: string | null }) {
  const { data, isLoading, isError } = useChatMessages(inviteId);
  const send = useSendChatMessage(inviteId);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const msgs = data?.messages ?? [];

  // Keep the newest message in view whenever the thread grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="chat-panel">
      <div
        className="chat-msgs"
        ref={listRef}
        role="log"
        aria-label={`Chat with ${opp ?? "your partner"}`}
      >
        {isLoading ? (
          <p className="chat-hint">Loading messages…</p>
        ) : isError ? (
          <p className="chat-hint">Couldn't load messages — check your connection.</p>
        ) : msgs.length === 0 ? (
          <p className="chat-hint">No messages yet — sort out the details for game day.</p>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={"chat-msg" + (m.mine ? " mine" : "")}>
              <div className="chat-bubble">{m.body}</div>
              <span className="chat-time">{timeLabel(m.createdAt)}</span>
            </div>
          ))
        )}
      </div>

      {send.isError && <p className="chat-error" role="alert">Couldn't send — try again.</p>}

      {/* A form so Enter submits natively; the button double-guards on empty. */}
      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="chat-input"
          value={draft}
          maxLength={1000}
          placeholder={`Message ${opp ?? "your partner"}…`}
          aria-label="Chat message"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn-sm primary"
          type="submit"
          disabled={!draft.trim() || send.isPending}
        >
          <Icon name="send" size={14} /> {send.isPending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
