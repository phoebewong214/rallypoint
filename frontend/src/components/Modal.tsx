import React, { useEffect, useRef } from "react";
import { token } from "../theme/tokens";

/* The one modal primitive: a dimmed backdrop + an opaque card, centered. Closes
 * on Esc and on backdrop click (clicks inside the card don't bubble out), locks
 * body scroll while open, and optionally focuses an element on mount.
 *
 * Every modal in the app routes its chrome through here so the backdrop/card
 * styling lives in exactly ONE place — previously each modal hand-rolled it with
 * inline styles, which is how the same `var(--bg-1)` transparency bug shipped in
 * three different files. Pass `onSubmit` to make the card a <form>.
 *
 * MOUNT IT AT PAGE LEVEL, or portal it (see ChatModal.tsx): the backdrop is
 * `position: fixed`, and any ancestor with a transform becomes its containing
 * block — `.card`, `.session`, `.stat-card` and friends all set a hover
 * transform AND `overflow: hidden`, which pins and clips the "full-viewport"
 * backdrop inside that card. */
export function Modal({
  ariaLabel,
  onClose,
  onSubmit,
  maxWidth = 420,
  initialFocusRef,
  className,
  children,
}: {
  ariaLabel: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: number;
  initialFocusRef?: React.RefObject<any>;
  /** Extra class on the card, for modals needing CSS the inline base style
      can't express (e.g. the chat modal going full-screen on phones). */
  className?: string;
  children: React.ReactNode;
}) {
  // Callers routinely pass an inline `onClose={() => ...}` — a new function
  // identity on every parent render. The side effects below must be IMMUNE to
  // that: if they re-ran per identity, the body scroll lock would be released
  // and re-applied on every render above the modal, so any modal whose content
  // triggers refetches while open (the chat dialog invalidates queries as
  // messages arrive/are read) would flash the page scrollbar in and out —
  // the "flickering modal" bug. So: Esc reads the LATEST onClose through a
  // ref, and the focus/listener/scroll-lock effect runs strictly once per
  // mount (empty deps — everything it needs is reachable via refs).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRefRef = useRef(initialFocusRef);
  initialFocusRefRef.current = initialFocusRef;
  useEffect(() => {
    initialFocusRefRef.current?.current?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const cardStyle: React.CSSProperties = {
    width: "100%", maxWidth, background: token.card,
    border: `1px solid ${token.border}`, borderRadius: 16, padding: 24,
    display: "flex", flexDirection: "column", gap: 14,
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16,
      }}
    >
      {onSubmit ? (
        <form onClick={stop} onSubmit={onSubmit} style={cardStyle} className={className}>{children}</form>
      ) : (
        <div onClick={stop} style={cardStyle} className={className}>{children}</div>
      )}
    </div>
  );
}

export default Modal;
