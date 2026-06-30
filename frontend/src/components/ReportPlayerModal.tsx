import React, { useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "../contexts/ToastContext";
import { playersApi, REPORT_REASON_OPTIONS } from "../api/players";
import type { ReportReason } from "../api/players";
import { ApiError } from "../api/client";

/* Report a player for trust & safety review. Files into the admin queue
 * (POST /players/:id/report). Reused anywhere a player is shown. */
export function ReportPlayerModal({
  playerId,
  playerName,
  onClose,
}: {
  playerId: number | string;
  playerName: string;
  onClose: () => void;
}) {
  const { show } = useToast();
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await playersApi.report(playerId, { reason, details: details.trim() || undefined });
      show("Report submitted — our team will review it.", "success");
      onClose();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not submit report", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal ariaLabel={`Report ${playerName}`} onClose={onClose} onSubmit={submit} maxWidth={440}>
      <h3 style={{ margin: 0 }}>Report {playerName}</h3>
      <p style={{ margin: "-6px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
        Reports are private and go to the RallyPoint team. Use this for harassment,
        no-shows, fake profiles, or anything that felt unsafe.
      </p>

      <div className="field">
        <label className="field-label">Reason</label>
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label">What happened? (optional)</label>
        <textarea
          className="input textarea"
          rows={4}
          value={details}
          maxLength={1000}
          placeholder="Add any detail that helps us review this…"
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </Modal>
  );
}

export default ReportPlayerModal;
