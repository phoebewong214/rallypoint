import React, { useRef } from "react";
import { Spinner } from "./Skeleton";
import { Modal } from "./Modal";
import { token } from "../theme/tokens";

/* Confirmation dialog for destructive / irreversible actions (e.g. cancelling a
   confirmed game). Focus lands on the primary button so keyboard users start
   inside the dialog; Esc / backdrop close are handled by <Modal>. */
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

  return (
    <Modal ariaLabel={title} onClose={onClose} maxWidth={400} initialFocusRef={confirmRef}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
      {body && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: token.textDim }}>{body}</p>
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
            background: danger ? token.rose : token.green,
            color: danger ? "#fff" : token.greenInk,
          }}
        >
          {busy ? <><Spinner /> …</> : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
