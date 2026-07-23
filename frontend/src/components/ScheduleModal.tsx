import React, { useRef, useState } from "react";
import { Icon } from "../rally-shared";
import { Spinner } from "./Skeleton";
import { Modal } from "./Modal";
import { CourtPicker } from "./CourtPicker";
import { UpcomingDatesStrip, freeBandsLabel } from "./UpcomingDates";
import type { AvailabilitySlotDTO } from "../types";
import type { ApiCourt } from "../api/courts";

/* Pick a time for a game (+ optional note). Used three ways:
   - Find Partner: propose a SPECIFIC time OR an open WINDOW (allowWindow).
   - Sessions: reschedule a legacy game / counter an invite with a specific time.
   Submits ISO strings: onSubmit(startISO, endISO | null, note?). endISO is set
   only when the user offered a window. */

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
  allowWindow = false,
  minISO,
  maxISO,
  allowCourt = false,
  courtOptions = [],
  defaultCourt,
  partnerName,
  partnerSlots,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle?: string;
  defaultISO?: string | null;
  submitLabel: string;
  busy?: boolean;
  // Show a "specific time / time window" toggle (Find Partner invites).
  allowWindow?: boolean;
  // Constrain the pickable range (e.g. proposing a time inside an offered window).
  minISO?: string | null;
  maxISO?: string | null;
  // Show a court picker (Find Partner invites) — onSubmit gets the court slug.
  allowCourt?: boolean;
  courtOptions?: ApiCourt[];
  defaultCourt?: string | null;
  // The other player's weekly availability, projected onto real dates so the
  // picker isn't a blind guess. Tapping a date fills the input's date part.
  partnerName?: string;
  partnerSlots?: AvailabilitySlotDTO[];
  onSubmit: (startISO: string, endISO: string | null, note?: string, court?: string | null) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"specific" | "window">("specific");
  const [start, setStart] = useState(() => defaultWhen(defaultISO));
  // Window end defaults to two hours after the start.
  const [end, setEnd] = useState(() => {
    const s = new Date(defaultWhen(defaultISO));
    s.setHours(s.getHours() + 2);
    return toLocalInput(s);
  });
  const [note, setNote] = useState("");
  const [court, setCourt] = useState<string | null>(defaultCourt ?? null);
  // Lower bound is the later of "now" and any caller-supplied minimum.
  const now = toLocalInput(new Date());
  const minWhen = minISO ? toLocalInput(new Date(minISO)) : now;
  const maxWhen = maxISO ? toLocalInput(new Date(maxISO)) : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  const windowInvalid = mode === "window" && new Date(end) <= new Date(start);

  // Partner availability, keyed off the currently picked date.
  const hasPartnerTimes = (partnerSlots ?? []).some((s) => s.status > 0);
  const pickedDate = start.slice(0, 10);
  const partnerHint = hasPartnerTimes ? freeBandsLabel(partnerSlots, pickedDate) : null;
  const pickDate = (iso: string) => {
    const newStart = `${iso}T${start.slice(11) || "18:00"}`;
    setStart(newStart);
    if (new Date(end) <= new Date(newStart)) {
      const e = new Date(newStart);
      e.setHours(e.getHours() + 2);
      setEnd(toLocalInput(e));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || windowInvalid) return;
    const startISO = new Date(start).toISOString();
    const endISO = mode === "window" ? new Date(end).toISOString() : null;
    onSubmit(startISO, endISO, note.trim() || undefined, allowCourt ? court : undefined);
  };

  const tabBtn = (m: "specific" | "window", label: string, icon: any) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className="btn-sm"
      aria-pressed={mode === m}
      style={{
        flex: 1,
        justifyContent: "center",
        background: mode === m ? "var(--blue-ghost)" : "transparent",
        border: "1px solid " + (mode === m ? "var(--blue-border)" : "var(--border)"),
        color: mode === m ? "var(--text)" : "var(--text-dim)",
        fontWeight: mode === m ? 700 : 500,
      }}
    >
      <Icon name={icon} size={14} /> {label}
    </button>
  );

  return (
    <Modal ariaLabel={title} onClose={onClose} maxWidth={420} onSubmit={submit} initialFocusRef={inputRef}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>{subtitle}</p>
          )}
        </div>

        {allowWindow && (
          <div style={{ display: "flex", gap: 8 }}>
            {tabBtn("specific", "Specific time", "calendar")}
            {tabBtn("window", "Time window", "clock")}
          </div>
        )}

        {hasPartnerTimes && (
          <UpcomingDatesStrip
            slots={partnerSlots}
            title={`When ${partnerName ?? "they"}'s usually free — tap a date`}
            selectedISO={pickedDate}
            onPickDate={pickDate}
          />
        )}

        <div className="field">
          <label className="field-label" htmlFor="sched-when">
            <Icon name="calendar" size={13} /> {mode === "window" ? "Window starts" : "Date & time"}
          </label>
          <input
            ref={inputRef}
            id="sched-when"
            className="input"
            type="datetime-local"
            value={start}
            min={minWhen}
            max={maxWhen}
            onChange={(e) => setStart(e.target.value)}
            required
          />
          {hasPartnerTimes && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
              {partnerHint
                ? <>{partnerName ?? "They"} is usually free that day: <b style={{ color: "var(--green-text)" }}>{partnerHint}</b>.</>
                : <>{partnerName ?? "They"} hasn't marked that day as free — they can still accept.</>}
            </p>
          )}
        </div>

        {mode === "window" && (
          <div className="field">
            <label className="field-label" htmlFor="sched-end">
              <Icon name="clock" size={13} /> Window ends
            </label>
            <input
              id="sched-end"
              className="input"
              type="datetime-local"
              value={end}
              min={start || minWhen}
              max={maxWhen}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
            {windowInvalid && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--red, #ff6b6b)" }}>
                The window has to end after it starts.
              </p>
            )}
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
              They'll pick an exact time inside this window.
            </p>
          </div>
        )}

        {allowCourt && (
          <div className="field">
            <label className="field-label"><Icon name="pin" size={13} /> Court (optional)</label>
            <CourtPicker options={courtOptions} value={court} onChange={setCourt} placeholder="Pick a court" />
          </div>
        )}

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
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !start || windowInvalid}
            style={{ flex: 1, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? <><Spinner /> Sending…</> : submitLabel}
          </button>
        </div>
    </Modal>
  );
}

export default ScheduleModal;
