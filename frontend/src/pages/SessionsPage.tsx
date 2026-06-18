import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { IconName } from "../types";
import { TopNav, Icon, Avatar } from "../rally-shared";
import {
  useSessions, useAcceptSession, useDeclineSession,
  useCancelSession, useRescheduleSession, useCompleteSession,
} from "../hooks/useSessions";
import { useToast } from "../contexts/ToastContext";
import { ScheduleModal } from "../components/ScheduleModal";

const SESSIONS = [
  // ----- Upcoming -----
  {
    id: 1, bucket: "upcoming", status: "confirmed",
    opp: "Maya Patel", oppHandle: "@mayap",
    sport: "Pickleball",
    court: "Maggie Daley Park Tennis", courtMiles: "0.6",
    day: "06", month: "Jun", weekday: "Tomorrow", time: "8:00 AM",
    next: true,
  },
  {
    id: 2, bucket: "upcoming", status: "pending",
    opp: "Jordan Williams", oppHandle: "@jordanw",
    sport: "Tennis",
    court: "Lincoln Park Cultural Center Tennis Courts", courtMiles: "3.1",
    day: "08", month: "Jun", weekday: "Thu", time: "6:30 PM",
    sentByMe: true,
  },
  {
    id: 3, bucket: "upcoming", status: "confirmed",
    opp: "Aisha Johnson", oppHandle: "@aishaj",
    sport: "Pickleball",
    court: "Lake Shore Park", courtMiles: "1.2",
    day: "10", month: "Jun", weekday: "Sat", time: "9:30 AM",
  },

  // ----- Requests (received) -----
  {
    id: 4, bucket: "requests", status: "requested",
    opp: "Marcus Chen", oppHandle: "@marcusc",
    sport: "Tennis",
    court: "Wicker Park Tennis Courts", courtMiles: "3.4",
    day: "11", month: "Jun", weekday: "Sun", time: "10:00 AM",
    note: "Up for an early Sunday match? I'll bring new balls.",
  },

  // ----- Past -----
  {
    id: 5, bucket: "past", status: "completed",
    opp: "Maya Patel",
    sport: "Pickleball",
    court: "Maggie Daley Park Tennis",
    day: "01", month: "Jun", weekday: "Sun", time: "8:00 AM",
    result: "W", score: "11–7, 11–9",
  },
  {
    id: 6, bucket: "past", status: "completed",
    opp: "Jordan Williams",
    sport: "Tennis",
    court: "Grant Park Tennis Center",
    day: "30", month: "May", weekday: "Fri", time: "6:30 PM",
    result: "W", score: "6–3, 4–6, 7–5",
  },
  {
    id: 7, bucket: "past", status: "completed",
    opp: "Marcus Chen",
    sport: "Tennis",
    court: "Wicker Park Tennis Courts",
    day: "26", month: "May", weekday: "Mon", time: "7:00 AM",
    result: "L", score: "3–6, 2–6",
  },
  {
    id: 8, bucket: "past", status: "completed",
    opp: "Aisha Johnson",
    sport: "Pickleball",
    court: "Lake Shore Park",
    day: "23", month: "May", weekday: "Fri", time: "9:00 AM",
    result: "W", score: "11–4, 11–8",
  },
  {
    id: 9, bucket: "past", status: "completed",
    opp: "Sofía Rodríguez",
    sport: "Pickleball",
    court: "Welles Park",
    day: "20", month: "May", weekday: "Tue", time: "5:00 PM",
    result: "L", score: "9–11, 7–11",
  },
];

const StatusPill = ({ status, sentByMe }) => {
  const map = {
    confirmed: { label: "Confirmed", cls: "confirmed" },
    pending:   { label: sentByMe ? "Awaiting reply" : "Awaiting your reply", cls: "pending" },
    requested: { label: "New request", cls: "requested" },
    completed: { label: "Completed", cls: "completed" },
    cancelled: { label: "Cancelled", cls: "cancelled" },
  };
  const m = map[status] || { label: status, cls: "" };
  return (
    <span className={"status-pill " + m.cls}>
      <span className="pulse" />
      {m.label}
    </span>
  );
};

function SessionRow({ s, onAccept, onDecline, onCancel, onReschedule, onComplete, onSoon, busy }: {
  s: any;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onCancel: (id: number) => void;
  onReschedule: (s: any) => void;
  onComplete: (s: any) => void;
  onSoon: (feature: string) => void;
  busy?: boolean;
}) {
  return (
    <article className={"session" + (s.next ? " next" : "")}>
      <div className="date-block">
        <span className="date-month">{s.month}</span>
        <span className="date-day">{s.day}</span>
        <span className="date-weekday">{s.weekday}</span>
        <span className="date-time">{s.time}</span>
      </div>

      <div className="sess-body">
        <Avatar name={s.opp} size="md" />
        <div className="sess-info">
          <div className="sess-line1">
            <span className="sess-vs">vs</span>
            <span className="sess-opp">{s.opp}</span>
          </div>
          <div className="sess-meta">
            <span className="sess-meta-item">
              <b>{s.sport}</b>
            </span>
            <span className="sess-meta-item">
              <Icon name="pin" size={14} /> {s.court}
              {s.courtMiles && (
                <span style={{ color: "var(--text-low)" }}>· {s.courtMiles} mi</span>
              )}
            </span>
            {s.note && (
              <span style={{
                width: "100%",
                marginTop: 6,
                padding: "8px 12px",
                background: "var(--blue-ghost)",
                border: "1px solid var(--blue-border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 13,
                fontStyle: "italic",
                lineHeight: 1.45,
              }}>
                "{s.note}"
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sess-right">
        {s.status === "completed" && s.result ? (
          <div className="result-line">
            <span className={"result-tag " + s.result.toLowerCase()}>{s.result}</span>
            {s.score}
          </div>
        ) : (
          <StatusPill status={s.status} sentByMe={s.sentByMe} />
        )}

        <div className="sess-actions">
          {s.status === "confirmed" && (
            <>
              <button className="btn-sm primary" type="button" onClick={() => onComplete(s)}>
                <Icon name="check" size={14} stroke={2.5} /> Mark as played
              </button>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)}>Reschedule</button>
              <button className="btn-sm danger" type="button" onClick={() => onCancel(s.id)} disabled={busy}>Cancel</button>
            </>
          )}
          {s.status === "pending" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)}>Reschedule</button>
              <button className="btn-sm danger" type="button" onClick={() => onCancel(s.id)} disabled={busy}>Cancel</button>
            </>
          )}
          {s.status === "requested" && (
            <>
              <button className="btn-sm primary" type="button" onClick={() => onAccept(s.id)} disabled={busy}>
                <Icon name="check" size={14} stroke={2.5} /> {busy ? "…" : "Accept"}
              </button>
              <button className="btn-sm ghost" type="button" onClick={() => onReschedule(s)}>Propose new time</button>
              <button className="btn-sm danger" type="button" onClick={() => onDecline(s.id)} disabled={busy}>Decline</button>
            </>
          )}
          {s.status === "completed" && (
            <>
              <button className="btn-sm ghost" type="button" onClick={() => onSoon("Match details")}>View Details</button>
              <button className="btn-sm primary" type="button" onClick={() => onSoon("Rematch booking")}>
                <Icon name="bolt" size={13} stroke={2.4} /> Rematch
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

const TABS = [
  { id: "upcoming", label: "Upcoming",  icon: "calendar" },
  { id: "requests", label: "Requests",  icon: "bell" },
  { id: "past",     label: "Past",      icon: "trophy" },
];

// Tab-specific empty-state copy so an empty tab tells the user what belongs here.
const EMPTY_COPY: Record<string, { title: string; sub: string }> = {
  upcoming: { title: "No games scheduled", sub: "Find a partner and send a request to set one up." },
  requests: { title: "No pending requests", sub: "When someone invites you, accept or propose a new time here." },
  past:     { title: "No past games yet", sub: "Games you mark as played show up here." },
};

/* "Mark as played" — outcome and score are optional so a casual hit can be
   logged with neither. */
function CompleteModal({ opp, busy, onSubmit, onClose }: {
  opp: string | null;
  busy?: boolean;
  onSubmit: (outcome: "won" | "lost" | undefined, score?: string) => void;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState<"won" | "lost" | "casual">("casual");
  const [score, setScore] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(outcome === "casual" ? undefined : outcome, score.trim() || undefined);
  };
  const opts: [typeof outcome, string][] = [
    ["won", "I won"], ["lost", "I lost"], ["casual", "Just for fun"],
  ];
  return (
    <div
      role="dialog" aria-modal="true" aria-label="Mark as played" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", padding: 16 }}
    >
      <form
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        style={{ width: "100%", maxWidth: 420, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>How did it go?</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>vs {opp ?? "your partner"}</p>
        </div>
        <div className="pill-group" role="radiogroup" aria-label="Result">
          {opts.map(([k, label]) => (
            <button
              key={k} type="button" role="radio" aria-checked={outcome === k}
              className={"pill" + (outcome === k ? " active" : "")}
              onClick={() => setOutcome(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="score">Score (optional)</label>
          <input id="score" className="input" value={score} maxLength={80}
            placeholder="e.g. 11-7, 11-9" onChange={(e) => setScore(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SessionsPage() {
  const [tab, setTab] = useState("upcoming");
  const { show, soon } = useToast();

  /* Live sessions from the API. An EMPTY array is a real "no sessions yet"
     answer (new users) — only fall back to the demo array when the backend
     never responds, so real users never see fabricated matches. */
  const { data: apiData } = useSessions();
  const liveSessions = apiData ? apiData.sessions : null;
  const sessions = liveSessions ?? (SESSIONS as any);
  const dataSource: "live" | "demo" = liveSessions ? "live" : "demo";

  const accept = useAcceptSession();
  const decline = useDeclineSession();
  const cancel = useCancelSession();
  const reschedule = useRescheduleSession();
  const complete = useCompleteSession();

  // The session being rescheduled / marked-played (each opens its modal).
  const [reschedTarget, setReschedTarget] = useState<any | null>(null);
  const [completeTarget, setCompleteTarget] = useState<any | null>(null);

  const handleAccept = (id: number) => {
    accept.mutate(id, {
      onSuccess: () => show("Game confirmed", "success"),
      onError:   () => show("Couldn't accept — try again", "error"),
    });
  };
  const handleDecline = (id: number) => {
    decline.mutate(id, {
      onSuccess: () => show("Request declined", "success"),
      onError:   () => show("Couldn't decline — try again", "error"),
    });
  };
  const handleCancel = (id: number) => {
    cancel.mutate(id, {
      onSuccess: () => show("Game cancelled", "success"),
      onError:   () => show("Couldn't cancel — try again", "error"),
    });
  };
  const handleReschedule = (iso: string, note?: string) => {
    if (!reschedTarget) return;
    reschedule.mutate(
      { id: reschedTarget.id, scheduledAt: iso, note },
      {
        onSuccess: () => {
          setReschedTarget(null);
          show("New time proposed — waiting on them to confirm", "success");
        },
        onError: () => show("Couldn't reschedule — try again", "error"),
      },
    );
  };
  const handleComplete = (outcome: "won" | "lost" | undefined, score?: string) => {
    if (!completeTarget) return;
    complete.mutate(
      { id: completeTarget.id, outcome, score },
      {
        onSuccess: () => {
          setCompleteTarget(null);
          show("Logged — nice game!", "success");
        },
        onError: () => show("Couldn't save — try again", "error"),
      },
    );
  };
  const busyId = accept.isPending
    ? accept.variables
    : decline.isPending
    ? decline.variables
    : cancel.isPending
    ? cancel.variables
    : null;

  const counts = useMemo(() => ({
    upcoming: sessions.filter((s: any) => s.bucket === "upcoming").length,
    requests: sessions.filter((s: any) => s.bucket === "requests").length,
    past:     sessions.filter((s: any) => s.bucket === "past").length,
  }), [sessions]);

  // Real stats derived from the session list (no hardcoded numbers).
  const stats = useMemo(() => {
    const completed = sessions.filter((s: any) => s.status === "completed");
    const wins = completed.filter((s: any) => s.result === "W").length;
    const losses = completed.filter((s: any) => s.result === "L").length;
    const decided = wins + losses;
    const pending = sessions.filter((s: any) => s.status === "pending");
    const pendingSent = pending.filter((s: any) => s.sentByMe).length;
    return {
      completed: completed.length,
      wins,
      losses,
      winRate: decided ? Math.round((wins / decided) * 100) : null,
      pending: pending.length,
      pendingSent,
      pendingReceived: pending.length - pendingSent,
      nextUp: sessions.find((s: any) => s.bucket === "upcoming") ?? null,
    };
  }, [sessions]);

  const visible = sessions.filter((s: any) => s.bucket === tab);

  return (
    <>
      <TopNav active="matches" />

      <main className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">
              <span className="dot" />
              {dataSource === "demo"
                ? "Showing example sessions while we reconnect"
                : `${counts.upcoming} upcoming · ${counts.requests} request${counts.requests === 1 ? "" : "s"}`}
            </div>
            <h1 className="h1">My <em>sessions.</em></h1>
            <p className="sub">
              Track every match — from the request to the final score.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <button className="btn-ghost" type="button" onClick={() => soon("Calendar sync")}>
              <Icon name="calendar" size={15} /> Calendar
            </button>
            <Link to="/find" className="btn-primary" style={{ textDecoration: "none" }}>
              <Icon name="plus" size={16} stroke={2.5} /> Schedule Game
            </Link>
          </div>
        </header>

        {/* Stats */}
        <section className="stats-row">
          <div className="stat-card">
            <span className="label">Upcoming</span>
            <span className="value">{counts.upcoming}</span>
            <span className="sub">
              {stats.nextUp ? `Next: ${stats.nextUp.weekday}, ${stats.nextUp.time}` : "Nothing scheduled"}
            </span>
          </div>
          <div className="stat-card">
            <span className="label">Pending Confirmations</span>
            <span className="value">{stats.pending}</span>
            <span className="sub">{stats.pendingSent} sent · {stats.pendingReceived} received</span>
          </div>
          <div className="stat-card">
            <span className="label">Games Played</span>
            <span className="value">{stats.completed}</span>
            <span className="sub">{stats.completed === 0 ? "No games yet" : "Completed"}</span>
          </div>
          <div className="stat-card accent">
            <span className="label">Win Rate</span>
            <span className="value">{stats.winRate === null ? "—" : `${stats.winRate}%`}</span>
            <span className="sub">{stats.wins}W · {stats.losses}L</span>
          </div>
        </section>

        {/* Tabs */}
        <div className="tab-bar" role="tablist" aria-label="Session filter">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={"tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon as IconName} size={15} /> {t.label}
              <span className="tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div className="section-head">
          <h2 className="section-title">
            {tab === "upcoming" && <>Upcoming <span className="count">{counts.upcoming} scheduled</span></>}
            {tab === "requests" && <>Game Requests <span className="count">{counts.requests} waiting</span></>}
            {tab === "past"     && <>Match History <span className="count">{counts.past} completed</span></>}
          </h2>
        </div>

        <div className="session-list">
          {visible.length === 0 ? (
            <div className="empty">
              <div className="ico-wrap"><Icon name="calendar" size={24} /></div>
              <h3 className="empty-title">{EMPTY_COPY[tab]?.title ?? "Nothing here yet"}</h3>
              <p className="empty-sub">{EMPTY_COPY[tab]?.sub ?? "When you book a game, it'll show up right here."}</p>
              {tab !== "requests" && (
                <Link className="btn-primary" to="/find">
                  <Icon name="search" size={15} stroke={2.4} /> Find a Partner
                </Link>
              )}
            </div>
          ) : (
            visible.map((s: any) => (
              <SessionRow
                key={s.id}
                s={s}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onCancel={handleCancel}
                onReschedule={setReschedTarget}
                onComplete={setCompleteTarget}
                onSoon={soon}
                busy={busyId === s.id}
              />
            ))
          )}
        </div>
      </main>

      {reschedTarget && (
        <ScheduleModal
          title="Propose a new time"
          subtitle={`with ${reschedTarget.opp ?? "your partner"}`}
          defaultISO={reschedTarget.scheduledAt}
          submitLabel="Send new time"
          busy={reschedule.isPending}
          onSubmit={handleReschedule}
          onClose={() => setReschedTarget(null)}
        />
      )}

      {completeTarget && (
        <CompleteModal
          opp={completeTarget.opp}
          busy={complete.isPending}
          onSubmit={handleComplete}
          onClose={() => setCompleteTarget(null)}
        />
      )}
    </>
  );
}

export default SessionsPage;
