import React, { useState } from "react";
import { Icon } from "../rally-shared";
import { Spinner } from "./Skeleton";

/* Pick a date/time (+ optional note). Used for proposing a game (Find Partner)
   and for rescheduling (Sessions). Submits an ISO string. */

function pad(n: number) {
  return String(n).padStart(2, "0");
}
// Format a Date as the local value an <input type="datetime-local"> expects.
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultWhen(iso?: string | null) {
  if (iso) return toLocalInput(new Date(iso));
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(18, 0, 0, 0); // tomorrow 6 PM as a sensible default
  return toLocalInput(t);
}

export function ScheduleModal({
  title,
  subtitle,
  defaultISO,
  submitLabel,
  busy,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle?: string;
  defaultISO?: string | null;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (iso: string, note?: string) => void;
  onClose: () => void;
}) {
  const [when, setWhen] = useState(() => defaultWhen(defaultISO));
  const [note, setNote] = useState("");
  const minWhen = toLocalInput(new Date());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return;
    onSubmit(new Date(when).toISOString(), note.trim() || undefined);
  };

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
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        style={{
          width: "100%", maxWidth: 420, background: "var(--bg-1)",
          border: "1px solid var(--border)", borderRadius: 16, padding: 24,
          display: "flex", flexDirection: "column", gap: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>{subtitle}</p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sched-when">
            <Icon name="calendar" size={13} /> Date &amp; time
          </label>
          <input
            id="sched-when"
            className="input"
            type="datetime-local"
            value={when}
            min={minWhen}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sched-note">Note (optional)</label>
          <textarea
            id="sched-note"
            className="input"
            rows={2}
            value={note}
            maxLength={500}
            placeholder="e.g. I'll bring fresh balls"
            onChange={(e) => setNote(e.target.value)}
            style={{ resize: "vertical", paddingTop: 10 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: "0 0 auto" }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !when} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
            {busy ? <><Spinner /> Sending…</> : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ScheduleModal;
