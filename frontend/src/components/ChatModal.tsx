import React, { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { ChatPanel } from "./ChatPanel";
import { Icon } from "../rally-shared";
import { useChatMessages, useMarkChatRead } from "../hooks/useChat";

/* How long a message must be on screen before it's reported read — soaks up
   bursts (SSE nudge refetches) into one report. */
const READ_DEBOUNCE_MS = 400;

/* The chat thread for one confirmed game, in a centered dialog (full-screen on
   phones). Owns the "seen = read" wiring: while the dialog is open, the newest
   rendered message id is debounce-reported to the server's read position, so
   opening the chat clears this game's unread badges — on every device.
   The thread itself renders through the same ChatPanel as before. */
export function ChatModal({
  inviteId,
  opp,
  when,
  onClose,
}: {
  inviteId: number;
  opp: string | null;
  /** Human-readable game time for the header, e.g. "Thu, Aug 20 · 6:00 PM". */
  when: string | null;
  onClose: () => void;
}) {
  // Same ['chat', inviteId] query the panel renders from (no extra fetch) —
  // read here so this component knows the newest id to report, including when
  // a new message lands while the dialog is open.
  const { data } = useChatMessages(inviteId);
  const markRead = useMarkChatRead(inviteId);
  const msgs = data?.messages ?? [];
  const latestId = msgs.length ? msgs[msgs.length - 1].id : 0;

  const reported = useRef(0);
  const mutateRef = useRef(markRead.mutate);
  mutateRef.current = markRead.mutate;
  useEffect(() => {
    if (!latestId || latestId <= reported.current) return;
    const t = setTimeout(() => {
      reported.current = latestId;
      mutateRef.current(latestId, {
        // Let the next arriving message retry a failed report instead of
        // permanently believing this one landed.
        onError: () => { reported.current = 0; },
      });
    }, READ_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [latestId]);

  return (
    <Modal
      ariaLabel={`Chat with ${opp ?? "your partner"}`}
      onClose={onClose}
      maxWidth={560}
      className="chat-modal"
    >
      <header className="chat-modal-head">
        <div>
          <h3 className="chat-modal-title">{opp ?? "Your partner"}</h3>
          {when && <p className="chat-modal-sub">{when}</p>}
        </div>
        <button
          type="button"
          className="btn-icon-sq"
          aria-label="Close chat"
          onClick={onClose}
        >
          <Icon name="x" size={16} />
        </button>
      </header>
      <ChatPanel inviteId={inviteId} opp={opp} />
    </Modal>
  );
}
