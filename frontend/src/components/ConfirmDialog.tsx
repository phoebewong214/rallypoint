import React, { useEffect, useRef } from "react";
import { Spinner } from "./Skeleton";

/* Confirmation dialog for destructive / irreversible actions (e.g. cancelling a
   confirmed game). Closes on Esc or backdrop click; focus moves to the primary
   button on open so keyboard users land inside the dialog. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Keep it",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 400, background: "var(--bg-1)",
          border: "1px solid var(--border)", borderRadius: 16, padding: 24,
          display: "flex", flexDirection: "column", gap: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
        {body && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" }}>{body}</p>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 16px", borderRadius: 10, border: "none", cursor: busy ? "default" : "pointer",
              fontSize: 14, fontWeight: 700, opacity: busy ? 0.7 : 1,
              background: danger ? "var(--rose)" : "var(--green)",
              color: danger ? "#fff" : "var(--green-ink)",
            }}
          >
            {busy ? <><Spinner /> …</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
