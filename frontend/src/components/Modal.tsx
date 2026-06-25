import React, { useEffect } from "react";
import { token } from "../theme/tokens";

/* The one modal primitive: a dimmed backdrop + an opaque card, centered. Closes
 * on Esc and on backdrop click (clicks inside the card don't bubble out), locks
 * body scroll while open, and optionally focuses an element on mount.
 *
 * Every modal in the app routes its chrome through here so the backdrop/card
 * styling lives in exactly ONE place — previously each modal hand-rolled it with
 * inline styles, which is how the same `var(--bg-1)` transparency bug shipped in
 * three different files. Pass `onSubmit` to make the card a <form>. */
export function Modal({
  ariaLabel,
  onClose,
  onSubmit,
  maxWidth = 420,
  initialFocusRef,
  children,
}: {
  ariaLabel: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  maxWidth?: number;
  initialFocusRef?: React.RefObject<any>;
  children: React.ReactNode;
}) {
  useEffect(() => {
    initialFocusRef?.current?.focus?.();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, initialFocusRef]);

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
        <form onClick={stop} onSubmit={onSubmit} style={cardStyle}>{children}</form>
      ) : (
        <div onClick={stop} style={cardStyle}>{children}</div>
      )}
    </div>
  );
}

export default Modal;
