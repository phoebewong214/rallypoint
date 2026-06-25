import React, { useRef, useState } from "react";
import { Icon } from "../rally-shared";
import { Spinner } from "./Skeleton";
import { Modal } from "./Modal";
import type { CreateAppointmentBody } from "../api/appointments";

/* Create an open game ("appointment") at a court: pick a time, sport, how many
   players, and an optional note. Others can then join (or waitlist). */
function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultWhen() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(18, 0, 0, 0);
  return toLocalInput(t);
}

export function AppointmentModal({
  courtName, sports, defaultSport, busy, onSubmit, onClose,
}: {
  courtName: string;
  sports: ("Tennis" | "Pickleball")[];
  defaultSport: "Tennis" | "Pickleball";
  busy?: boolean;
  onSubmit: (body: CreateAppointmentBody) => void;
  onClose: () => void;
}) {
  const [when, setWhen] = useState(defaultWhen);
  const [sport, setSport] = useState<"Tennis" | "Pickleball">(defaultSport);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const minWhen = toLocalInput(new Date());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return;
    onSubmit({ sport, scheduledAt: new Date(when).toISOString(), maxPlayers, note: note.trim() || undefined });
  };

  return (
    <Modal ariaLabel="Make an appointment" onClose={onClose} maxWidth={440} onSubmit={submit} initialFocusRef={inputRef}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Make an appointment</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>Open game at {courtName} — others can join</p>
        </div>

        {sports.length > 1 && (
          <div className="field">
            <label className="field-label"><Icon name="trophy" size={13} /> Sport</label>
            <div className="pill-group" role="radiogroup">
              {sports.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={sport === s}
                  className={"pill" + (sport === s ? " active" : "")} onClick={() => setSport(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="appt-when"><Icon name="calendar" size={13} /> Date &amp; time</label>
          <input ref={inputRef} id="appt-when" className="input" type="datetime-local" value={when} min={minWhen} onChange={(e) => setWhen(e.target.value)} required />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="appt-max"><Icon name="users" size={13} /> Players wanted</label>
          <div className="select">
            <select id="appt-max" value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
              <option value={2}>2 (singles)</option>
              <option value={4}>4 (doubles)</option>
              <option value={6}>6</option>
              <option value={8}>8</option>
            </select>
            <span className="select-caret"><Icon name="chevron" size={16} /></span>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="appt-note">Note (optional)</label>
          <textarea id="appt-note" className="input" rows={2} value={note} maxLength={500}
            placeholder="e.g. casual rally, all levels welcome" onChange={(e) => setNote(e.target.value)} style={{ resize: "vertical", paddingTop: 10 }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: "0 0 auto" }}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy || !when} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
            {busy ? <><Spinner /> Posting…</> : "Post open game"}
          </button>
        </div>
    </Modal>
  );
}

export default AppointmentModal;
