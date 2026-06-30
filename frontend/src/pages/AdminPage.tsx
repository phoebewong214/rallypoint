import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TopNav } from "../rally-shared";
import { useToast } from "../contexts/ToastContext";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Spinner } from "../components/Skeleton";
import { adminApi } from "../api/admin";
import type {
  AdminStats, AdminUser, AdminUserPatch, AdminReport, ReportStatus,
  SupportTicket, TicketStatus, AdminCourt, AdminCourtPatch, AdminOverview,
} from "../api/admin";
import { ApiError } from "../api/client";

/* Admin-side short labels for report reasons (the app shows fuller wording). */
const REASON_LABEL: Record<string, string> = {
  harassment: "Harassment",
  no_show: "No-show",
  fake_profile: "Fake profile",
  inappropriate: "Inappropriate content",
  safety: "Safety concern",
  other: "Other",
};

const RATINGS = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
const PER_PAGE = 25;

/* ---- Dashboard stat cards ---- */
const StatCard: React.FC<{ label: string; value: number | string; hint?: string }> = ({ label, value, hint }) => (
  <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
    <div className="field-label" style={{ letterSpacing: "0.1em" }}>{label}</div>
    {hint && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{hint}</div>}
  </div>
);

/* ---- Tab header button (Users | Reports) ---- */
const TabButton: React.FC<{ active: boolean; onClick: () => void; badgeCount?: number; children: React.ReactNode }> = ({
  active, onClick, badgeCount, children,
}) => (
  <button
    onClick={onClick}
    style={{
      background: "none", border: "none", cursor: "pointer", marginBottom: -1,
      padding: "10px 4px", fontSize: 15, fontWeight: 700,
      color: active ? "var(--text)" : "var(--text-dim)",
      borderBottom: `2px solid ${active ? "var(--accent, #6366f1)" : "transparent"}`,
      display: "inline-flex", alignItems: "center", gap: 8,
    }}
  >
    {children}
    {badgeCount ? <span style={{ ...badge("danger"), padding: "1px 7px" }}>{badgeCount}</span> : null}
  </button>
);

/* ---- Segmented filter chips (Users tab: status + sport) ---- */
function FilterChips({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (key: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button
          key={o.key}
          className={"btn-ghost btn-sm" + (value === o.key ? " active" : "")}
          style={value === o.key ? { borderColor: "var(--accent, #6366f1)", color: "var(--accent, #6366f1)" } : undefined}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Edit-user modal ---- */
interface EditState {
  name: string;
  email: string;
  handle: string;
  emailVerified: boolean;
  resendVerification: boolean;
  isActive: boolean;
  location: string;
  primarySport: "Tennis" | "Pickleball";
  ratings: Record<string, string>; // sport -> NTRP, for every profile the user has
  lat: string;
  lng: string;
  bio: string;
}

function fromUser(u: AdminUser): EditState {
  const primarySport = (u.primarySport as "Tennis" | "Pickleball") || "Pickleball";
  const ratings: Record<string, string> = {};
  for (const p of u.sportProfiles || []) ratings[p.sport] = p.ntrp;
  if (!ratings[primarySport]) ratings[primarySport] = "3.5";
  return {
    name: u.name || "",
    email: u.email || "",
    handle: u.handle || "",
    emailVerified: !!u.emailVerified,
    resendVerification: false,
    isActive: u.isActive !== false, // default active unless explicitly suspended
    location: u.location || "",
    primarySport,
    ratings,
    lat: u.lat != null ? String(u.lat) : "",
    lng: u.lng != null ? String(u.lng) : "",
    bio: u.bio || "",
  };
}

function EditUserModal({
  user,
  onClose,
  onSaved,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
  onDeleted: (id: string) => void;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<EditState>(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k: keyof EditState) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e?.target?.type === "checkbox" ? e.target.checked : (e?.target?.value ?? e) }));
  const setRating = (sport: string) => (e: any) =>
    setForm((f) => ({ ...f, ratings: { ...f.ratings, [sport]: e.target.value } }));

  const sportsToShow = Object.keys(form.ratings).length
    ? Object.keys(form.ratings)
    : [form.primarySport];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // The sent set is the complete desired list: one profile per sport the
      // user has, each with its (possibly edited) rating. Always include the
      // primary sport so it survives the upsert.
      const profiles = sportsToShow.map((sport) => {
        const existing = (user.sportProfiles || []).find((p) => p.sport === sport);
        return {
          sport: sport as "Tennis" | "Pickleball",
          ntrp: form.ratings[sport] || existing?.ntrp || "3.5",
          homeCourt: existing?.homeCourt ?? undefined,
          availabilitySummary: existing?.availability ?? undefined,
        };
      });
      if (!profiles.some((p) => p.sport === form.primarySport)) {
        profiles.push({ sport: form.primarySport, ntrp: form.ratings[form.primarySport] || "3.5", homeCourt: undefined, availabilitySummary: undefined });
      }

      const patch: AdminUserPatch = {
        name: form.name.trim(),
        email: form.email.trim(),
        handle: form.handle.trim(),
        emailVerified: form.emailVerified,
        resendVerification: form.resendVerification || undefined,
        isActive: form.isActive,
        location: form.location.trim(),
        primarySport: form.primarySport,
        bio: form.bio,
        sportProfiles: profiles,
        lat: form.lat.trim() ? Number(form.lat) : undefined,
        lng: form.lng.trim() ? Number(form.lng) : undefined,
      };
      const { user: updated } = await adminApi.updateUser(user.id, patch);
      show(form.resendVerification ? "Saved — verification email sent" : "User updated", "success");
      onSaved(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save changes";
      show(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminApi.deleteUser(user.id);
      show("Account permanently deleted", "success");
      onDeleted(user.id);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not delete account", "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal ariaLabel={`Edit ${user.name}`} onClose={onClose} onSubmit={handleSave} maxWidth={460}>
      <h3 style={{ margin: 0 }}>Edit user</h3>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: -8 }}>
        ID {user.id} · joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
      </div>

      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={form.name} onChange={set("name")} />
      </div>

      <div className="field">
        <label className="field-label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set("email")} />
      </div>

      <div className="field">
        <label className="field-label">Handle</label>
        <input className="input" value={form.handle} onChange={set("handle")} placeholder="@handle" />
      </div>

      <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={form.emailVerified} onChange={set("emailVerified")} disabled={form.resendVerification} />
        <span>Email verified</span>
      </label>
      <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: -6 }}>
        <input type="checkbox" checked={form.resendVerification} onChange={set("resendVerification")} />
        <span style={{ fontSize: 13 }}>Re-send verification email to this address (marks it unverified)</span>
      </label>

      <div className="field">
        <label className="field-label">Location</label>
        <input className="input" value={form.location} onChange={set("location")} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Latitude</label>
          <input className="input" value={form.lat} onChange={set("lat")} placeholder="41.79" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Longitude</label>
          <input className="input" value={form.lng} onChange={set("lng")} placeholder="-87.59" />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Primary sport</label>
        <select className="input" value={form.primarySport} onChange={set("primarySport")}>
          <option value="Pickleball">Pickleball</option>
          <option value="Tennis">Tennis</option>
        </select>
      </div>

      <div className="field">
        <label className="field-label">Ratings (NTRP/DUPR)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sportsToShow.map((sport) => (
            <div key={sport} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 90, fontSize: 13, color: "var(--text-dim)" }}>
                {sport}{sport === form.primarySport ? " ·primary" : ""}
              </span>
              <select className="input" style={{ flex: 1 }} value={form.ratings[sport] || "3.5"} onChange={setRating(sport)}>
                {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Bio</label>
        <textarea className="input textarea" rows={3} value={form.bio} onChange={set("bio")} />
      </div>

      {/* Trust & safety: suspending locks the account out and logs it out everywhere. */}
      <div
        style={{
          border: `1px solid ${form.isActive ? "var(--border)" : "var(--danger, #dc2626)"}`,
          borderRadius: 10, padding: "12px 14px", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {form.isActive ? "Account active" : "Account suspended"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {form.isActive
              ? "Suspending locks them out and hides them from matching."
              : "Locked out of the app and hidden from matching."}
          </div>
        </div>
        <button
          type="button"
          className={form.isActive ? "btn-ghost btn-sm" : "btn-primary btn-sm"}
          style={form.isActive ? { color: "var(--danger, #dc2626)", borderColor: "var(--danger, #dc2626)" } : undefined}
          onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
        >
          {form.isActive ? "Suspend" : "Reactivate"}
        </button>
      </div>

      {/* Danger zone: permanent deletion (distinct from the reversible suspend above). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Permanently delete this account and all of their data. Can't be undone.
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ color: "var(--danger, #dc2626)", borderColor: "var(--danger, #dc2626)", whiteSpace: "nowrap" }}
          onClick={() => setConfirmDelete(true)}
        >
          Delete account
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${user.name}?`}
          body={`This permanently removes ${user.handle} and all of their profile, games, invites, reports and tickets. This cannot be undone. To temporarily lock the account instead, use Suspend.`}
          confirmLabel="Delete forever"
          cancelLabel="Keep account"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}

/* ---- Dashboard home: activity overview ---- */
const PHASE_LABEL: Record<string, string> = {
  awaiting_opponent: "awaiting reply",
  settling_time: "settling time",
  confirmed: "confirmed",
  declined: "declined",
  cancelled: "cancelled",
};

function OverviewPanel() {
  const { show } = useToast();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .overview()
      .then(setData)
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load overview", "error"))
      .finally(() => setLoading(false));
  }, [show]);

  if (loading) return <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>;
  if (!data) return null;

  const peak = Math.max(1, ...data.signupSeries.map((d) => d.count));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 14-day signups sparkline */}
      <div className="card" style={{ padding: 18 }}>
        <div className="field-label" style={{ letterSpacing: "0.1em", marginBottom: 12 }}>NEW SIGNUPS · LAST 14 DAYS</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
          {data.signupSeries.map((d) => (
            <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.date}: ${d.count}`}>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{d.count || ""}</div>
              <div
                style={{
                  width: "100%", borderRadius: 4,
                  height: `${Math.round((d.count / peak) * 56) + 2}px`,
                  background: d.count ? "var(--accent, #6366f1)" : "var(--border)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* Recent signups */}
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent signups</h2>
          {data.recentSignups.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No signups yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recentSignups.map((u) => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                  <div>
                    <b>{u.name}</b> <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{u.handle}</span>
                  </div>
                  <span style={{ color: "var(--text-dim)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(u.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent games */}
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent games</h2>
          {data.recentInvites.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No game invites yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.recentInvites.map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                  <div>
                    <b>{i.inviter || "—"}</b> <span style={{ color: "var(--text-dim)" }}>→</span> <b>{i.invitee || "—"}</b>
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}> · {i.sport} · {PHASE_LABEL[i.phase] || i.phase}</span>
                  </div>
                  <span style={{ color: "var(--text-dim)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(i.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Trust & safety: report queue ---- */
const REPORT_FILTERS: { key: ReportStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "reviewed", label: "Reviewed" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ReportCard({
  report,
  busy,
  onResolve,
}: {
  report: AdminReport;
  busy: boolean;
  onResolve: (action: { status: "reviewed" | "dismissed"; suspend?: boolean }) => void;
}) {
  const r = report;
  const reportedSuspended = r.reportedIsActive === false;
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={badge("danger")}>{REASON_LABEL[r.reason] || r.reason}</span>
        {r.status !== "open" && (
          <span style={badge(r.status === "dismissed" ? "warn" : "ok")}>
            {r.status === "dismissed" ? "Dismissed" : "Reviewed"}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>{fmtDate(r.createdAt)}</span>
      </div>

      <div style={{ fontSize: 14 }}>
        <span style={{ color: "var(--text-dim)" }}>Reported </span>
        <b>{r.reported?.name || "—"}</b>{" "}
        <span style={{ color: "var(--text-dim)" }}>{r.reported?.handle}</span>
        {reportedSuspended && <span style={{ ...badge("danger"), marginLeft: 8 }}>Suspended</span>}
        <span style={{ color: "var(--text-dim)" }}> · by </span>
        <b>{r.reporter?.name || "—"}</b>{" "}
        <span style={{ color: "var(--text-dim)" }}>{r.reporter?.handle}</span>
      </div>

      {r.details && (
        <div style={{ fontSize: 13, background: "var(--bg-1, rgba(0,0,0,0.15))", borderRadius: 8, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
          {r.details}
        </div>
      )}

      {r.status === "open" ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onResolve({ status: "dismissed" })}>
            Dismiss
          </button>
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onResolve({ status: "reviewed" })}>
            Mark reviewed
          </button>
          {!reportedSuspended && (
            <button
              className="btn-primary btn-sm"
              style={{ background: "var(--danger, #dc2626)", borderColor: "var(--danger, #dc2626)" }}
              disabled={busy}
              onClick={() => onResolve({ status: "reviewed", suspend: true })}
            >
              Suspend user & resolve
            </button>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Resolved {r.resolvedAt ? `on ${fmtDate(r.resolvedAt)}` : ""}
          {r.resolvedBy ? ` by ${r.resolvedBy.name}` : ""}
          {r.resolutionNote ? ` — ${r.resolutionNote}` : ""}
        </div>
      )}
    </div>
  );
}

function ReportsPanel({ onChanged }: { onChanged: () => void }) {
  const { show } = useToast();
  const [status, setStatus] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listReports(status)
      .then((res) => setReports(res.reports))
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load reports", "error"))
      .finally(() => setLoading(false));
  }, [status, show]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (r: AdminReport, action: { status: "reviewed" | "dismissed"; suspend?: boolean }) => {
    setBusyId(r.id);
    try {
      await adminApi.reviewReport(r.id, action);
      show(action.suspend ? "User suspended · report resolved" : "Report resolved", "success");
      load();
      onChanged(); // stats: open-report + suspended counts may have changed
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not update report", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {REPORT_FILTERS.map((f) => (
          <button
            key={f.key}
            className={"btn-ghost btn-sm" + (status === f.key ? " active" : "")}
            style={status === f.key ? { borderColor: "var(--accent, #6366f1)", color: "var(--accent, #6366f1)" } : undefined}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>
          {status === "open" ? "No open reports — all clear. 🎉" : "No reports here."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} busy={busyId === r.id} onResolve={(a) => resolve(r, a)} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---- Support desk: ticket queue ---- */
const TICKET_FILTERS: { key: TicketStatus | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

function TicketCard({
  ticket,
  busy,
  onSetStatus,
}: {
  ticket: SupportTicket;
  busy: boolean;
  onSetStatus: (status: TicketStatus) => void;
}) {
  const t = ticket;
  const [showHistory, setShowHistory] = useState(false);
  const mailto = t.user?.email
    ? `mailto:${t.user.email}?subject=${encodeURIComponent("Re: your RallyPoint support request")}`
    : undefined;
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <b>{t.user?.name || "—"}</b>
        <span style={{ color: "var(--text-dim)", fontSize: 13 }}>{t.user?.handle}</span>
        {t.status === "closed" && <span style={badge("ok")}>Resolved</span>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>{fmtDate(t.createdAt)}</span>
      </div>

      <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{t.message}</div>

      {t.history.length > 0 && (
        <div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowHistory((s) => !s)}
          >
            {showHistory ? "Hide" : "Show"} chat history ({t.history.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {t.history.map((m, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--text-dim)", fontWeight: 700 }}>
                    {m.role === "user" ? "User" : "Assistant"}:
                  </span>{" "}
                  {m.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
        {mailto && (
          <a className="btn-ghost btn-sm" href={mailto} target="_blank" rel="noreferrer">Reply by email</a>
        )}
        {t.status === "open" ? (
          <button className="btn-primary btn-sm" disabled={busy} onClick={() => onSetStatus("closed")}>
            Mark resolved
          </button>
        ) : (
          <button className="btn-ghost btn-sm" disabled={busy} onClick={() => onSetStatus("open")}>
            Reopen
          </button>
        )}
      </div>

      {t.status === "closed" && (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Resolved {t.resolvedAt ? `on ${fmtDate(t.resolvedAt)}` : ""}
          {t.resolvedBy ? ` by ${t.resolvedBy.name}` : ""}
          {t.resolutionNote ? ` — ${t.resolutionNote}` : ""}
        </div>
      )}
    </div>
  );
}

function SupportPanel({ onChanged }: { onChanged: () => void }) {
  const { show } = useToast();
  const [status, setStatus] = useState<TicketStatus | "all">("open");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listSupport(status)
      .then((res) => setTickets(res.tickets))
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load tickets", "error"))
      .finally(() => setLoading(false));
  }, [status, show]);

  useEffect(() => { load(); }, [load]);

  const setTicketStatus = async (t: SupportTicket, next: TicketStatus) => {
    setBusyId(t.id);
    try {
      await adminApi.updateTicket(t.id, { status: next });
      show(next === "closed" ? "Ticket resolved" : "Ticket reopened", "success");
      load();
      onChanged(); // stats: open-ticket count changed
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not update ticket", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TICKET_FILTERS.map((f) => (
          <button
            key={f.key}
            className={"btn-ghost btn-sm" + (status === f.key ? " active" : "")}
            style={status === f.key ? { borderColor: "var(--accent, #6366f1)", color: "var(--accent, #6366f1)" } : undefined}
            onClick={() => setStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>
          {status === "open" ? "No open tickets — inbox zero. 🎉" : "No tickets here."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((t) => (
            <TicketCard key={t.id} ticket={t} busy={busyId === t.id} onSetStatus={(s) => setTicketStatus(t, s)} />
          ))}
        </div>
      )}
    </>
  );
}

/* ---- Court management ---- */
const ALL_SPORTS: ("Tennis" | "Pickleball")[] = ["Tennis", "Pickleball"];

interface CourtForm {
  name: string;
  slug: string;
  address: string;
  lat: string;
  lng: string;
  sports: ("Tennis" | "Pickleball")[];
  primarySport: "tennis" | "pickleball";
  courtCount: string;
  surface: string;
  lights: boolean;
  isActive: boolean;
}

function courtToForm(c: AdminCourt | null): CourtForm {
  return {
    name: c?.name || "",
    slug: c?.slug || "",
    address: c?.address || "",
    lat: c?.lat != null ? String(c.lat) : "",
    lng: c?.lng != null ? String(c.lng) : "",
    sports: c?.sports?.length ? c.sports : ["Pickleball"],
    primarySport: (c?.primarySport as "tennis" | "pickleball") || "pickleball",
    courtCount: c?.courtCount != null ? String(c.courtCount) : "1",
    surface: c?.surface || "",
    lights: !!c?.lights,
    isActive: c?.isActive ?? true,
  };
}

function CourtFormModal({
  court,
  onClose,
  onSaved,
}: {
  court: AdminCourt | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<CourtForm>(() => courtToForm(court));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CourtForm) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e?.target?.type === "checkbox" ? e.target.checked : e.target.value }));
  const toggleSport = (s: "Tennis" | "Pickleball") =>
    setForm((f) => ({ ...f, sports: f.sports.includes(s) ? f.sports.filter((x) => x !== s) : [...f.sports, s] }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { show("A court name is required", "error"); return; }
    if (form.sports.length === 0) { show("Pick at least one sport", "error"); return; }
    setSaving(true);
    try {
      const body: AdminCourtPatch = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        sports: form.sports,
        primarySport: form.primarySport,
        courtCount: Number(form.courtCount) || 1,
        surface: form.surface.trim() || undefined,
        lights: form.lights,
        lat: form.lat.trim() ? Number(form.lat) : undefined,
        lng: form.lng.trim() ? Number(form.lng) : undefined,
        isActive: form.isActive,
      };
      if (court && form.slug.trim() && form.slug.trim() !== court.slug) body.slug = form.slug.trim();
      if (court) await adminApi.updateCourt(court.id, body);
      else await adminApi.createCourt(body);
      show(court ? "Court updated" : "Court added", "success");
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not save court", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal ariaLabel={court ? `Edit ${court.name}` : "Add court"} onClose={onClose} onSubmit={save} maxWidth={480}>
      <h3 style={{ margin: 0 }}>{court ? "Edit court" : "Add court"}</h3>

      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={form.name} onChange={set("name")} />
      </div>

      {court && (
        <div className="field">
          <label className="field-label">Slug (URL id)</label>
          <input className="input" value={form.slug} onChange={set("slug")} placeholder="auto from name" />
        </div>
      )}

      <div className="field">
        <label className="field-label">Address</label>
        <input className="input" value={form.address} onChange={set("address")} />
      </div>

      <div className="field">
        <label className="field-label">Sports</label>
        <div style={{ display: "flex", gap: 16 }}>
          {ALL_SPORTS.map((s) => (
            <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={form.sports.includes(s)} onChange={() => toggleSport(s)} />
              <span>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Primary sport</label>
          <select className="input" value={form.primarySport} onChange={set("primarySport")}>
            <option value="pickleball">Pickleball</option>
            <option value="tennis">Tennis</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label"># of courts</label>
          <input className="input" type="number" min={1} value={form.courtCount} onChange={set("courtCount")} />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Surface</label>
        <input className="input" value={form.surface} onChange={set("surface")} placeholder="Hard, clay, …" />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Latitude</label>
          <input className="input" value={form.lat} onChange={set("lat")} placeholder="41.79" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Longitude</label>
          <input className="input" value={form.lng} onChange={set("lng")} placeholder="-87.59" />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={form.lights} onChange={set("lights")} />
        <span>Has lights</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={form.isActive} onChange={set("isActive")} />
        <span>Active (uncheck to hide from the app)</span>
      </label>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : court ? "Save changes" : "Add court"}
        </button>
      </div>
    </Modal>
  );
}

function CourtsPanel() {
  const { show } = useToast();
  const [courts, setCourts] = useState<AdminCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCourt | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listCourts()
      .then((res) => setCourts(res.courts))
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load courts", "error"))
      .finally(() => setLoading(false));
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const onSaved = () => { setEditing(null); setAdding(false); load(); };

  const remove = async (c: AdminCourt) => {
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return;
    try {
      await adminApi.deleteCourt(c.id);
      show("Court deleted", "success");
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not delete court", "error");
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Courts {courts.length > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({courts.length})</span>}</h2>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add court</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>
        ) : courts.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>No courts yet — add the first one.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <th style={th}>Name</th>
                  <th style={th}>Sports</th>
                  <th style={th}>Courts</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courts.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{c.address || c.slug}</div>
                    </td>
                    <td style={td}>{c.sports.join(", ") || "—"}</td>
                    <td style={td}>{c.courtCount}{c.lights ? " · lights" : ""}</td>
                    <td style={td}>
                      <span style={badge(c.isActive ? "ok" : "warn")}>{c.isActive ? "Active" : "Hidden"}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>
                      <button className="btn-ghost btn-sm" style={{ color: "var(--danger, #dc2626)", marginLeft: 6 }} onClick={() => remove(c)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adding && <CourtFormModal court={null} onClose={() => setAdding(false)} onSaved={onSaved} />}
      {editing && <CourtFormModal court={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </>
  );
}

/* ---- Page ---- */
const AdminPage: React.FC = () => {
  const { show } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "unverified" | "suspended" | "admin">("all");
  const [sportFilter, setSportFilter] = useState<"all" | "Tennis" | "Pickleball">("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<"overview" | "users" | "reports" | "support" | "courts">("overview");

  // Debounce the search box so each keystroke doesn't fire a request.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Changing a filter resets to the first page.
  useEffect(() => { setPage(1); }, [statusFilter, sportFilter]);

  const loadStats = useCallback(() => {
    adminApi.stats().then(setStats).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    setLoading(true);
    adminApi
      .listUsers({
        q: debouncedQ,
        status: statusFilter,
        sport: sportFilter === "all" ? undefined : sportFilter,
        page,
        perPage: PER_PAGE,
      })
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
        setPages(res.pages);
      })
      .catch((err) => show(err instanceof ApiError ? err.message : "Failed to load users", "error"))
      .finally(() => setLoading(false));
  }, [debouncedQ, statusFilter, sportFilter, page, show]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const onSaved = (updated: AdminUser) => {
    setUsers((arr) => arr.map((u) => (u.id === updated.id ? updated : u)));
    setEditing(null);
    loadStats(); // verified-count etc. may have changed
  };

  const onDeleted = (id: string) => {
    setUsers((arr) => arr.filter((u) => u.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setEditing(null);
    loadStats(); // user/verified/admin counts changed
  };

  const statCards = useMemo(() => {
    if (!stats) return null;
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 32 }}>
        <StatCard label="Users" value={stats.users.total} hint={`${stats.users.real} real · ${stats.users.demo} demo`} />
        <StatCard label="Verified" value={stats.users.verified} hint={`${stats.users.total - stats.users.verified} unverified`} />
        <StatCard label="New (7d)" value={stats.users.new7d} hint={`${stats.users.new30d} in 30d`} />
        <StatCard label="Suspended" value={stats.users.suspended} />
        <StatCard label="Open reports" value={stats.openReports} hint={stats.openReports > 0 ? "needs review" : "all clear"} />
        <StatCard label="Open tickets" value={stats.openTickets} hint={stats.openTickets > 0 ? "awaiting reply" : "inbox zero"} />
        <StatCard label="Admins" value={stats.users.admins} />
        <StatCard label="Invites" value={stats.invites} />
        <StatCard label="Appointments" value={stats.appointments} />
        <StatCard label="Courts" value={stats.courts} />
      </div>
    );
  }, [stats]);

  return (
    <>
      <TopNav active="admin" />
      <main className="page">
        <div className="eyebrow"><span className="dot" />ADMIN</div>
        <h1 style={{ marginTop: 8, marginBottom: 24 }}>Dashboard</h1>

        {statCards}

        {/* Tabs: user management vs the trust & safety report queue. */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabButton>
          <TabButton active={tab === "users"} onClick={() => setTab("users")}>Users</TabButton>
          <TabButton active={tab === "reports"} onClick={() => setTab("reports")} badgeCount={stats?.openReports || 0}>
            Reports
          </TabButton>
          <TabButton active={tab === "support"} onClick={() => setTab("support")} badgeCount={stats?.openTickets || 0}>
            Support
          </TabButton>
          <TabButton active={tab === "courts"} onClick={() => setTab("courts")}>Courts</TabButton>
        </div>

        {tab === "overview" && <OverviewPanel />}
        {tab === "reports" && <ReportsPanel onChanged={loadStats} />}
        {tab === "support" && <SupportPanel onChanged={loadStats} />}
        {tab === "courts" && <CourtsPanel />}

        {tab === "users" && (
        <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Users {total > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({total})</span>}</h2>
          <input
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="Search name, email or @handle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Filters: status + sport, stack on top of the search. */}
        <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <FilterChips
            value={statusFilter}
            onChange={(k) => setStatusFilter(k as typeof statusFilter)}
            options={[
              { key: "all", label: "All" },
              { key: "verified", label: "Verified" },
              { key: "unverified", label: "Unverified" },
              { key: "suspended", label: "Suspended" },
              { key: "admin", label: "Admins" },
            ]}
          />
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <FilterChips
            value={sportFilter}
            onChange={(k) => setSportFilter(k as typeof sportFilter)}
            options={[
              { key: "all", label: "All sports" },
              { key: "Tennis", label: "Tennis" },
              { key: "Pickleball", label: "Pickleball" },
            ]}
          />
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Spinner /></div>
          ) : users.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)" }}>No users found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Sport</th>
                    <th style={th}>Status</th>
                    <th style={th}>Joined</th>
                    <th style={{ ...th, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const prof = (u.sportProfiles || []).find((p) => p.sport === u.primarySport);
                    return (
                      <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{u.handle}</div>
                        </td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>
                          {u.primarySport ? `${u.primarySport}${prof ? ` · ${prof.ntrp}` : ""}` : "—"}
                        </td>
                        <td style={td}>
                          {u.isActive === false ? (
                            <span style={badge("danger")}>Suspended</span>
                          ) : (
                            <span style={badge(u.emailVerified ? "ok" : "warn")}>
                              {u.emailVerified ? "Verified" : "Unverified"}
                            </span>
                          )}
                          {u.isAdmin && <span style={{ ...badge("admin"), marginLeft: 6 }}>Admin</span>}
                        </td>
                        <td style={{ ...td, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : u.joined || "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button className="btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 18 }}>
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Page {page} / {pages}</span>
            <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
          </div>
        )}
        </>
        )}
      </main>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={onSaved} onDeleted={onDeleted} />}
    </>
  );
};

const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

function badge(kind: "ok" | "warn" | "admin" | "danger"): React.CSSProperties {
  const map = {
    ok: { color: "var(--green-deep)", border: "1px solid var(--green-deep)" },
    warn: { color: "var(--text-dim)", border: "1px solid var(--border)" },
    admin: { color: "var(--accent, #6366f1)", border: "1px solid var(--accent, #6366f1)" },
    danger: { color: "var(--danger, #dc2626)", border: "1px solid var(--danger, #dc2626)" },
  } as const;
  return {
    display: "inline-block", padding: "2px 8px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, ...map[kind],
  };
}

export default AdminPage;
